var cm = chrome.contextMenus;
var om = chrome.runtime.onMessage;
var t = chrome.tabs;
var remoteOptionId;
var s = chrome.storage.local;
var cn = chrome.notifications;

var APIURLS = {
    instantDld: 'https://offcloud.com/api/instant/download',
    cloudDld: 'https://offcloud.com/api/cloud/download',
    remoteDld: 'https://offcloud.com/api/remote/download',
    login: 'https://www.offcloud.com/login',
    checkLogin: 'https://offcloud.com/api/login/check',
    getRemoteId: 'https://offcloud.com/api/remote-account/list',
    remoteSet: 'https://www.offcloud.com/#/remote'
};
initMenus();
setRemoteAccount(false);
function setRemoteAccount(ifCallBack, callback) {
    $.get(APIURLS.getRemoteId, function (data) {
        if (data && data[0] != "<") {
            localStorage.remoteOptionId = remoteOptionId = data.data[0].remoteOptionId;
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
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.instantDld, false);
        }
    });
    cm.create({
        type: "normal",
        title: "Cloud download selected links",
        contexts: ["link", "selection"],
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.cloudDld, false);
        }
    });
    cm.create({
        type: "normal",
        title: "Remote download selected links",
        contexts: ["link", "selection"],
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.remoteDld, true);
        }


    });
    cm.create({
        type: "separator",
        contexts: ["link", "selection"]
    });
    cm.create({
        type: "normal",
        title: "Instant download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 0);
        }
    });
    cm.create({
        type: "normal",
        title: "Cloud download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 1);
        }
    });
    cm.create({
        type: "normal",
        title: "Remote download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 2);
        }
    });
}

function customDownload(tab, type) {
    s.set({customType: type, showType: "custom"}, function () {
        showModal(tab);
    });
}


function downloadAction(clickData, tab, api, remote) {
    if (clickData.linkUrl) {
        checkLogin(function () {
            processCall(api, clickData.linkUrl, remote, tab);
        });
    } else if (clickData.selectionText) {
        t.sendMessage(tab.id, {cmd: "getSelectedHtml"}, function (resp) {
            console.log(resp);
            if (resp && resp.html) {
                processMultipleLink(resp.html, true, remote, tab, api);
            }
        });
    }
}

function processMultipleLink(html, needReg, remote, tab, api) {
    var result = [];
    if (needReg) {
        result = findLinkByRegex(html);
    } else {
        result = findLinkByText(html);
    }
    checkLogin(function () {
        if (result && result.length > 1) {
            var requestList = [];
            for (var i = 0; i < result.length; i++) {
                var dataBody = { url: result[i]};
                if (remote) {
                    checkRemoteSet();
                    dataBody.remoteOptionId = remoteOptionId;
                }
                requestList.push($.ajax(api, {
                    method: 'POST',
                    data: dataBody
                }).fail(function () {
                    showErrorMessage();
                }));
            }
            var multiRequest = $.when.apply($, requestList);
            multiRequest.done(function (data) {
                var finalData = [];
                $.each(arguments, function (index, responseData) {
                    if (responseData[1] == "success") {
                        if (responseData[0].not_available) {
                            s.set({'result': responseData[0], isList: false, showType: "default"}, function () {
                                showModal(tab);
                            });
                            return false;
                        } else {
                            if (remote) {
                                checkRemoteSet();
                                s.set({'result': {remote: 'Transfer is in progress...'}, isList: false, showType: "default"}, function () {
                                    showModal(tab);
                                });
                                return false;
                            } else {
                                finalData.push(responseData[0].url);
                            }
                        }
                    } else {
                        var data = {error: "unknown"};
                        s.set({'result': data, isList: false, showType: "default"}, function () {
                            showModal(tab);
                        });
                    }
                });

                if (finalData.length != 0) {
                    s.set({'result': finalData, isList: true, showType: "default"}, function () {
                        showModal(tab);
                    });
                }
            });
        } else if (result && result.length == 1) {
            processCall(api, result[0], remote, tab);
        }

    });
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

function processCall(api, link, remote, tab) {
    var dataBody = { url: link};
    if (remote) {
        if (!checkRemoteSet()) {
            setRemoteAccount(true, function (rmtid) {
                dataBody.remoteOptionId = rmtid;
                processAjax(api, link, true, tab, dataBody);
            });
        } else {
            dataBody.remoteOptionId = remoteOptionId;
            processAjax(api, link, true, tab, dataBody);
        }
    } else {
        processAjax(api, link, false, tab, dataBody);
    }

}

function processAjax(api, link, remote, tab, dataBody) {
    $.ajax(api, {
        method: 'POST',
        data: dataBody
//        'contentType': 'multipart/form-data'
    }).success(function (data) {
        if (!data.not_available && remote) {
            data = {remote: 'Transfer is in progress...'};
        }
        s.set({'result': data, isList: false, showType: "default"}, function () {
            showModal(tab);
        });
    }).fail(function () {
        var data = {error: "unknown"};
        s.set({'result': data, isList: false, showType: "default"}, function () {
            showModal(tab);
        });
    });
}

function showModal(tab) {
    t.executeScript(tab.id, {file: 'injectFrame.js'});
}


function checkLogin(callback) {
    $.post(APIURLS.checkLogin, function (data) {
        if (data.loggedIn != 1) {
            notifyNotLogedIn();
        } else {
            callback();
        }
    }).fail(function () {
        showErrorMessage();
    });
}

om.addListener(function (req, sender, sendResponse) {
    var cmd = req.cmd;
    if (cmd == "copy") {
        var content = req.content;
        copyTextToClipboard(content);
        sendResponse({res: 'done'});
    } else if (cmd == "removeFrame") {
        t.executeScript(sender.tab.id, {code: 'document.body.removeChild(document.getElementById("momane_notifyFrame"))'});
    } else if (cmd == "custom") {
        t.executeScript(sender.tab.id, {code: 'document.body.removeChild(document.getElementById("momane_notifyFrame"))'});
        var currentApi;
        if (req.remote == 0) {
            currentApi = APIURLS.instantDld;
        } else if (req.remote == 1) {
            currentApi = APIURLS.cloudDld;
        } else {
            currentApi = APIURLS.remoteDld;
        }
        processMultipleLink(req.html, false, req.remote == 2, sender.tab, currentApi);
    }
});

function copyTextToClipboard(text) {
    var copyFrom = $('<textarea id="testt"/>');
    copyFrom.text(text);
    $('body').append(copyFrom);
    copyFrom.select();
    document.execCommand('copy', true);
    copyFrom.remove();
}

function showErrorMessage() {
    showNotification("errorMsg",
        { type: "basic",
            title: ' Offcloud.com is offline',
            message: 'Sorry, Offcloud.com is offline, please try again later'});
}

function notifyNotLogedIn() {
    showNotification("notlogin",
        { type: "basic",
            title: 'You are currently not logged in',
            message: 'You are currently not logged into Offcloud. Please log into your account...'},
        true,
        APIURLS.login);
}

function showNoRemoteSetNotify() {
    showNotification("noRemote",
        {type: "basic",
            title: "Remote Not Setted",
            message: "Please set your remote download account first"},
        true,
        APIURLS.remoteSet);
}

function showNotification(name, options, redirect, redirectUrl) {
    cn.clear(name, function () {
        cn.create(name, {
            type: options.type,
            iconUrl: 'icon64.png',
            title: options.title,
            message: options.message
        }, function () {
            if (redirect) {
                t.create({active: true, url: redirectUrl});
            }

        });
    });
}