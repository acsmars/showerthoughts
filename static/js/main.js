// Global Variables
var currentThought = {};
var debug = false

var id_token = null;

// Thought Viewcount 
var thoughtHistory = [];


// Communication Functions
function getThought(thoughtId = -1) {
	if (thoughtId > 0) {
		request = {
			requestedThought:thoughtId,
			type:"new"
		};
	}
	else {
		function genExclusions() {
			console.log('\nhistory ' + thoughtHistory);
			exclusions = thoughtHistory.slice(Math.max(thoughtHistory.length - 5, 0));
			console.log(exclusions);
			return exclusions;
		}
		request = {
			type:"new",
			excludeIds: genExclusions()
		};
	}
	thoughtRequest = sendRequest(request);
	thoughtRequest.done(function () {
		// Parse response
		currentThought = JSON.parse(thoughtRequest.responseText);

		// Add this item to history
		thoughtHistory.push(currentThought.id);

		// Set Text Area Value
		$("p.showerThoughtText").html(currentThought.text);
	});
};

function postThought() {
	event.preventDefault();
	text = $("#newThoughtText").val();
	if (text == "") {
		return
	}
	if (id_token == null) {
		return
	}
	postRequest = sendRequest({
		type:"post",
		idToken: id_token,
		text: text
	});
};




// Google Signon
function onSignIn(googleUser) {
	var profile = googleUser.getBasicProfile();
	console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
	id_token = googleUser.getAuthResponse().id_token;

	// sendRequest({
	// 	type:"login",
	// 	idToken: id_token
	// });
}

function signOut() {
	var auth2 = gapi.auth2.getAuthInstance();
	auth2.signOut().then(function () {
		console.log('User signed out.');
	});
	id_token = null;
}


// JSON post function
$.postJSON = function(url, data, callback) {
	return jQuery.ajax({
		'type': 'POST',
		'url': url,
		'contentType': 'application/json',
		'data': JSON.stringify(data),
		'dataType': 'json',
		'success': callback
	});
};

// Send request using the post method. Returns a promise, use .done() to wait for response
function sendRequest(payload) {
	return $.postJSON('/data', payload, function (data, status) {
		// Send request
		if (debug) {
			if (status) {
				console.log("Successful post: " + JSON.stringify(payload));
				console.log("Response: " + JSON.stringify(data))
			}
			else {
				console.log("Failed post: " + JSON.stringify(payload));
				console.log("Response: " + JSON.stringify(data))
			}
		}
	}, 'json')
};
 // Bindings
$( document ).ready(function() {
	$('.mainContainer').height($(window).height());
	
	// Click for next anywhere in mainContainer
	$('.mainContainer').click(function() {
		getThought();
	});

	// Add resize positioning bindings
	$( window ).on("resize", function () {
		$('.arrowLeft').position({my: "left center", at: "left center", of: ".mainContainer"});
		$('.arrowRight').position({my: "right center", at: "right center", of: ".mainContainer"});
		$('.showerThoughtContainer').position({my: "center center", at: "center center", of: ".mainContainer"});
	}).trigger('resize');


});

