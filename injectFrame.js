/**
 * Created by Hank on 9/12/2014.
 */
//var frame = '<iframe src="' + chrome.extension.getURL("notify.html") + '"' +
//    ' frameborder="0" width="100%" height="500px" style="position: absolute; top: 300px;"></iframe>';

var screenWidth = document.body.clientWidth / 2 - 300;
var notifyFrame = document.createElement("iframe");
notifyFrame.setAttribute("frameborder", "0");
notifyFrame.setAttribute("width", "600px");
notifyFrame.setAttribute("height", "218px");
notifyFrame.setAttribute("style", "border-radius: 6px;width:600px;background-color=transparent;position: fixed; left :" + screenWidth + "px;top: 200px;z-index:955861;box-shadow: 0 3px 9px rgba(0,0,0,.5)");
notifyFrame.setAttribute("src", chrome.extension.getURL("notify.html"));
notifyFrame.setAttribute("id", "momane_notifyFrame");


if (document.getElementById("momane_notifyFrame")) {
    document.body.removeChild(document.getElementById("momane_notifyFrame"));
}
document.body.appendChild(notifyFrame);