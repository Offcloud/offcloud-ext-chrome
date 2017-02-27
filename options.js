restoreOptions();

setEventHandlers();

function setEventHandlers(){
	document.getElementById('saveApiKeyBtn').addEventListener('click', function(){
		var apiKey = document.getElementById('apiKeyInput').value;
		chrome.storage.local.set({
			apiKey: apiKey
		}, function(){
			chrome.runtime.sendMessage({
				action: "setApiKey",
				newApiKey: apiKey
			});
			document.querySelector('.status-div').innerText = 'Your Api Key has been successfully changed!';
		});
	});
}

function restoreOptions(){
	chrome.storage.local.get('apiKey', function(object){
		if (object.apiKey != null)
			document.getElementById('apiKeyInput').value = object.apiKey;
	});
}