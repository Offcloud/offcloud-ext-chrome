/**
 * Created by Hank on 9/5/2014.
 */
var s = chrome.storage.local;
var sm = chrome.extension.sendMessage;
var errorList = {
    premium: "User must purchase a premium downloading addon for this download",
    links: "User must purchase a Link increase addon for this download",
    proxy: "User must purchase a proxy downloading addon for this download",
    video: "User must purchase a video sharing site support addon for this download",
    unknown: "Unknown error, please try one more time or contact us."
};

s.get(['result', 'isList', "showType", "customType"], function (i) {
    showBsModel(i.result, i.isList, i.showType, i.customType);
});

function showBsModel(msg, list, showType, customType) {
    var model = '<div class="modal" id="momane_modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true" style="position: absolute; width: 100%;height: 100%;">' +
        '<div class="modal-dialog" style="position: absolute; left: 0; top: 0;width: 100%; margin: 0;height: 100%;">' +
        ' <div class="modal-content" style="height: 100%;">' +
        ' <div class="modal-header">' +
        '    <button type="button" id="momane_modal_close" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>' +
        '  <h4 class="modal-title" id="myModalLabel">Your Offcloud.com links</h4>' +
        ' </div>' +
        ' <div class="modal-body" id="momane_modalBody"><textarea class="form-control" rows="3" style="font-size: 12px"></textarea>' +
        '  </div>' +
        '  <div class="modal-footer" id="momane_modal_footer">' +
        '      <button type="button" class="btn btn-default" id="momane_copy">Copy link(s)</button>' +
        '      <button type="button" class="btn btn-primary" id="momane_open">Open link(s) in new tab(s)</button>' +
        '   </div>' +
        '  </div>' +

        '   </div>' +
        '  </div>';
    if ($("#momane_modal").length != 0) {
        $("#momane_modal").remove();
    }
    $("body").append(model);
    var modalBody = $("#momane_modal");
    var modalMsgBody = $("#momane_modalBody");
    var modalCopyBtn = $("#momane_copy");
    var modalOpenBtn = $("#momane_open");
    var closeBtn = $('#momane_modal_close');
    var modalTitle = $("#myModalLabel");

    var modalFooter = $("#momane_modal_footer");
    closeBtn.click(function () {
        modalBody.fadeOut();
        modalBody.remove();
        sm({cmd: "removeFrame"});
    });
    if (showType != "custom") {
        if (!msg.remote && !msg.not_available && !msg.error) {
            var urlArea = modalMsgBody.find("textarea");
            urlArea.click(function () {
                urlArea.select();
            });
            if (!list) {
                urlArea.val(msg.url);

            } else {
                urlArea.val(msg.join("\n"));
            }
            modalTitle.text("Your Offcloud.com links");
            modalCopyBtn.click(function () {
                sm({
                    cmd: 'copy',
                    content: urlArea.val()
                }, function (resp) {
                    modalCopyBtn.fadeOut();
                    modalCopyBtn.fadeIn();
                });
            });

            modalOpenBtn.click(function () {
                if (!list) {
                    window.open(msg.url);
                } else {
                    var urlLists = urlArea.val();
                    if (urlLists) {
                        urlLists = urlLists.split("\n");
                        for (var i = 0; i < urlLists.length; i++) {
                            window.open(urlLists[i]);
                        }
                    }
                }

            });

        } else if (msg.error) {
            modalTitle.text("Error Occurred");
            modalMsgBody.html("<h5 style='color: red'>" + msg.error + "</h5>");
            modalFooter.html('<button type="button" class="btn btn-primary" id="momane_error">Check your Offcloud.com account</button>');
            $("#momane_error").click(function () {
                window.open("https://offcloud.com/");
            });
        } else {
            modalTitle.text("Your Offcloud.com results");
            var finalInfo = "";
            modalMsgBody.html("<h5>Your query to Offcloud.com API has returned the following:</h5>");
            if (!msg.remote) {
                if (msg.not_available) {
                    finalInfo = errorList[msg.not_available];
                } else {
                    finalInfo = errorList.unknown;
                }
                modalFooter.html('<button type="button" class="btn btn-primary" id="momane_error">Check your Offcloud.com account</button>');
                $("#momane_error").click(function () {
                    window.open("https://offcloud.com/");
                });
            }
            else if (msg.remote) {
                finalInfo = msg.remote;
                modalFooter.html('<button type="button" class="btn btn-primary" id="momane_remote">Check your Offcloud.com account</button>');
                $("#momane_remote").click(function () {
                    window.open(" https://offcloud.com/#/remote");
                });
            }
            modalMsgBody.append("<h6 style='color:#5e5e5e;font-size: 13px;font-weight: bolder;'>" + finalInfo + "</h6>");

        }
    } else {
        var cusModalTitle = ["Instant download custom links", "Cloud download custom links" , "Remote download custom links"];
        modalTitle.text(cusModalTitle[customType]);
        var processBtn = '<button type="button" class="btn btn-primary" id="momane_cus">Process link(s) to Offcloud.com</button>';
        modalFooter.html(processBtn);
        $("#momane_cus").click(function () {
            var customLinks = modalBody.find("textarea").val();
            console.log(customLinks);
            if (customLinks && customLinks.trim() != "") {
                sm({cmd: "custom", html: customLinks, remote: customType});
            } else {
                alert("Please input links you want to process.");
                modalBody.find("textarea").focus();
            }
        });

    }
    modalBody.fadeIn();
}