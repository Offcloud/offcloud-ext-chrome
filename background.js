var cm = chrome.contextMenus;
var om = chrome.runtime.onMessage;
var t = chrome.tabs;
var remoteOptionId;
var s = chrome.storage.local;
var cn = chrome.notifications;
var apiKey;

var APIURLS = {
    instantDld: 'https://offcloud.com/api/instant/download',
    cloudDld: 'https://offcloud.com/api/cloud/download',
    remoteDld: 'https://offcloud.com/api/remote/download',
    login: 'https://offcloud.com/login',
    checkLogin: 'https://offcloud.com/api/login/check',
    getRemoteId: 'https://offcloud.com/api/remote-account/list',
    remoteSet: 'https://www.offcloud.com/#/remote'
};

checkLogin(function() {
    getApiKey(function() {
        setRemoteAccount(false);
    });
});

initMenus();

function getApiKey(callback) {
    s.get('apiKey', function(result) {
        apiKey = result.apiKey;
        if (apiKey == null) {
            $.post('https://offcloud.com/api/account/get', function(data) {
                if (data.error) {
                    notifyNotLoggedIn();
                } else {
                    apiKey = data.apiKey;
                    s.set({
                        apiKey: apiKey
                    }, function() {
                        callback();
                    });
                }
            });
        } else {
            callback();
        }
    });
}

function setApiKey(newApiKey){
    s.set({
        apiKey: newApiKey
    }, function(){
        apiKey = newApiKey;
    });
}

function setRemoteAccount(ifCallBack, callback) {
    $.get(APIURLS.getRemoteId + "?apiKey=" + apiKey, function(data) {
        if (data && data[0] != "<") {
            localStorage.remoteOptionId = data.data[0].remoteOptionId;
            remoteOptionId = data.data[0].remoteOptionId;
            if (ifCallBack) {
                callback(data.data[0].remoteOptionId);
            }
        } else if (data[0] == "<") {
            showErrorMessage();
            return false;
        } else {
            showNoRemoteSetNotify();
            return false;
        }
    });
}

function checkRemoteSet() {
    if (!remoteOptionId) {
        showNoRemoteSetNotify();
        return false;
    }
}

function initMenus() {
    cm.removeAll();

    cm.create({
        type: "normal",
        title: "Instant download selected links",
        contexts: ["link", "selection"],
        onclick: function(clickData, tab) {
            downloadAction(clickData, tab, APIURLS.instantDld, false);
        }
    });
    cm.create({
        type: "normal",
        title: "Cloud download selected links",
        contexts: ["link", "selection"],
        onclick: function(clickData, tab) {
            downloadAction(clickData, tab, APIURLS.cloudDld, false);
        }
    });
    cm.create({
        type: "normal",
        title: "Remote download selected links",
        contexts: ["link", "selection"],
        onclick: function(clickData, tab) {
            downloadAction(clickData, tab, APIURLS.remoteDld, true);
        }
    });

    cm.create({
        type: "normal",
        title: "Instant download custom links",
        contexts: ["page_action"],
        onclick: function(clickData, tab) {
            customDownload(tab, 0);
        }
    });
    cm.create({
        type: "normal",
        title: "Cloud download custom links",
        contexts: ["page_action"],
        onclick: function(clickData, tab) {
            customDownload(tab, 1);
        }
    });
    cm.create({
        type: "normal",
        title: "Remote download custom links",
        contexts: ["page_action"],
        onclick: function(clickData, tab) {
            customDownload(tab, 2);
        }
    });
}

function customDownload(tab, type) {
    checkLogin(function() {
        if (apiKey == null) {
            getApiKey(function() {
                t.sendMessage(tab.id, {
                    cmd: "showModal",
                    type: type
                });
            });
            return;
        }

        t.sendMessage(tab.id, {
            cmd: "showModal",
            type: type
        });
    });
}

function downloadAction(clickData, tab, apiLink, remote) {
    checkLogin(function() {
        if (apiKey == null) {
            getApiKey(function() {
                startAction();
            });
            return;
        }

        startAction();

        //declared this in case the user hasn't got the api key
        function startAction() {
            apiLink += "?apiKey=" + apiKey;

            t.sendMessage(tab.id, {
                cmd: "appendLoader"
            });

            if (clickData.linkUrl) {
                processCall(apiLink + apiKey, clickData.linkUrl, remote, tab);
            } else if (clickData.selectionText) {
                t.sendMessage(tab.id, {
                    cmd: "getSelectedHtml"
                }, function(resp) {
                    if (resp && resp.html) {
                        processMultipleLink(resp.html, true, remote, tab, apiLink, resp.href);
                    }
                });
            }
        }
    });

}

function processMultipleLink(html, needReg, remote, tab, api, href) {
    var result = [];
    if (needReg) {
        result = findLinkByRegex(html);
    } else {
        result = findLinkByText(html);
    }

    result = result.map(function(link) {
        if (link.startsWith('http')) {
            return link;
        } else {
            return href + link;
        }
    });

    if (result && result.length > 1) {
        var requestList = [];
        for (var i = 0; i < result.length; i++) {
            var dataBody = {
                url: result[i]
            };
            if (remote) {
                checkRemoteSet();
                dataBody.remoteOptionId = remoteOptionId;
            }
            requestList.push($.ajax(api, {
                method: 'POST',
                data: dataBody
            }));
        }
        var multiRequest = $.when.apply($, requestList);
        multiRequest.done(function(data) {
            var finalData = [];
            $.each(arguments, function(index, responseData) {
                if (responseData[1] == "success") {
                    if (responseData[0].not_available) {
                        t.sendMessage(tab.id, {
                            cmd: "errorNotification"
                        });

                        return false;
                    } else {
                        if (remote) {
                            checkRemoteSet();
                            t.sendMessage(tab.id, {
                                cmd: "remoteInProcessNotification"
                            });
                            return false;
                        } else {
                            finalData.push(responseData[0].url);
                        }
                    }
                } else {
                    t.sendMessage(tab.id, {
                        cmd: "errorNotification"
                    });
                }
            });

            if (finalData.length != 0) {
                //copying the result to the clipboard
                var text = finalData.join("\n");
                copyTextToClipboard(text);

                t.sendMessage(tab.id, {
                    cmd: "successNotification"
                }, function() {
                    finalData.forEach(function(url) {
                        t.create({
                            url: url
                        });
                    });
                });
            }
        });
    } else if (result && result.length == 1) {
        processCall(api, result[0], remote, tab);
    }
}

function processCall(api, link, remote, tab) {
    var dataBody = {
        url: link
    };
    if (remote) {
        if (!remoteOptionId){
            setRemoteAccount(true, function(rmtid) {
                dataBody.remoteOptionId = rmtid;
                processAjax(api, link, true, tab, dataBody);
            }); 
        }
        else {
            dataBody.remoteOptionId = remoteOptionId;
            processAjax(api, link, true, tab, dataBody);  
        }
        
    } else {
        processAjax(api, link, false, tab, dataBody);
    }
}

function findLinkByRegex(html) {
    var linkReg = /href=[\'"]?([^\'" >]+)/g;
    var result = html.match(linkReg);
    for (var i = 0; i < result.length; i++) {
        result[i] = result[i].replace('href="', '');
    }
    return result;
}

function findLinkByText(text) {
    var urlReg = /[a-zA-z]+:\/\/[^\s]*/g;
    return text.match(urlReg);
}

function processAjax(api, link, remote, tab, dataBody) {
    $.ajax(api, {
        method: 'POST',
        data: dataBody
            //        'contentType': 'multipart/form-data'
    }).success(function(data) {
        if (!data.not_available && remote) {
            t.sendMessage(tab.id, {
                cmd: "remoteInProcessNotification"
            });
        } else if (!data.not_available) {
            //copying the result to the clipboard
            var url = data.url;
            copyTextToClipboard(url);

            t.sendMessage(tab.id, {
                cmd: "successNotification"
            }, function() {
                t.create({
                    url: url
                });
            });
        } else {
            t.sendMessage(tab.id, {
                cmd: "errorNotification"
            });
        }
    }).fail(function() {
        t.sendMessage(tab.id, {
            cmd: "errorNotification"
        });
    });
}

function checkLogin(callback) {
    $.get(APIURLS.checkLogin, function(response){
        var loggedIn = response.loggedIn;
        if (loggedIn)
            callback();
        else
            notifyNotLoggedIn();
    }).fail(function() {
        showErrorMessage();
    });
}

om.addListener(function(req, sender, sendResponse) {
    var cmd = req.cmd;

    if (req.action == "setApiKey")
        setApiKey(req.newApiKey);

    if (cmd == "copy") {
        var content = req.content;
        copyTextToClipboard(content);
        sendResponse({
            res: 'done'
        });
    } else if (cmd == "removeFrame") {
        t.executeScript(sender.tab.id, {
            code: 'document.body.removeChild(document.getElementById("momane_notifyFrame"))'
        });
    } else if (cmd == "custom") {
        var currentApi;
        if (req.type == 0) {
            currentApi = APIURLS.instantDld;
        } else if (req.type == 1) {
            currentApi = APIURLS.cloudDld;
        } else {
            currentApi = APIURLS.remoteDld;
        }
        currentApi += "?apiKey=" + apiKey;

        t.sendMessage(sender.tab.id, {
            cmd: "appendLoader"
        });
        processMultipleLink(req.html, false, req.type == 2, sender.tab, currentApi);
    }
});

function showErrorMessage() {
    showNotification("errorMsg", {
        type: "basic",
        title: ' Offcloud.com is offline',
        message: 'Sorry, Offcloud.com is offline, please try again later'
    });
}

function notifyNotLoggedIn() {
    showNotification("notlogin", {
            type: "basic",
            title: 'You are currently not logged in',
            message: 'You are currently not logged into Offcloud. Please log into your account...'
        },
        true,
        APIURLS.login);
}

function showNoRemoteSetNotify() {
    showNotification("noRemote", {
            type: "basic",
            title: "Remote Not Setted",
            message: "Please set your remote download account first"
        },
        true,
        APIURLS.remoteSet);
}

function showQueryisInProcessNotification() {
    showNotification("queryProcess", {
        type: "basic",
        title: "Your query is in process...",
        message: "Please wait until the query is finished!"
    });
}

function showRemoteProcessNotification() {
    showNotification("remoteProcess", {
        type: "basic",
        title: "Remote Transfer",
        message: "The transfer has started!"
    });
}

function showQueryResultNotification(result) {
    if (result == "success") {
        showNotification("queryResult", {
            type: "basic",
            title: "Query Result",
            message: "Result has been copied to clipboard!"
        });
    } else if (result == "error") {
        showNotification("queryResult", {
            type: "basic",
            title: "Query Result",
            message: "An error occured."
        });
    }
}

function showNotification(name, options, redirect, redirectUrl) {
    cn.clear(name, function() {
        cn.create(name, {
            type: options.type,
            iconUrl: 'icon64.png',
            title: options.title,
            message: options.message
        }, function() {
            if (redirect) {
                t.create({
                    active: true,
                    url: redirectUrl
                });
            }

        });
    });
}

function copyTextToClipboard(text) {
    var copyFrom = $('<textarea/>');
    copyFrom.text(text);
    $('body').append(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    copyFrom.remove();
}