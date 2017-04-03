// Global Variables
var currentThought = {};
var debug = false
var id_token = null;
var ready = true; // Do not strat new requests until the last one has finished
// User votes, updates with toggling
var userVotes = {funny: 0, deep: 0, dark: 0, dumb: 0}
// User votes, initial per thought
var initialUserVotes = {funny: 0, deep: 0, dark: 0, dumb: 0}
// Votes on the thought by other people, not including this user
var totalVotes = {funny: 0, deep: 0, dark: 0, dumb: 0}

// Thought Viewcount 
var thoughtHistory = [];

// Communication Functions
function getLast() {
	thoughtHistory.pop(); // Remove the current thought from history
	if (thoughtHistory.length < 1) {
		return null;
	}
	else {
		if (thoughtHistory.length < 2) {
			$('.previousButton').css('display','none');
		}
		lastThoughtId = thoughtHistory.pop();
		getThought(lastThoughtId);
	}
	
};

function getThought(thoughtId = -1) {
	if (thoughtId > 0) {
		request = {
			requestedThought:thoughtId,
			idToken: id_token,
			type:"new"

		};
	}
	else {
		function genExclusions() {
			exclusions = thoughtHistory.slice(Math.max(thoughtHistory.length - 5, 0));
			return exclusions;
		}
		request = {
			type:"new",
			idToken: id_token,
			excludeIds: genExclusions()
		};
	}
	ready = false;
	thoughtRequest = sendRequest(request);
	thoughtRequest.done(function () {
		// Parse response
		currentThought = JSON.parse(thoughtRequest.responseText);

		// Add this item to history
		thoughtHistory.push(currentThought.id);

		// Update vote data
		console.log(currentThought);

		// Set Text Area Value
		$("p.showerThoughtText").html(currentThought.text);

		// Update vote counts
		userVotes = currentThought.userVotes;
		initialUserVotes = JSON.parse(JSON.stringify(userVotes)) // Get deep copy of userVotes
		totalVotes = currentThought.totalVotes;
		updateVotes();

		// Recenter the text window
		$('.showerThoughtContainer').position({my: "center center", at: "center center", of: ".mainContainer"});
		ready = true;
	});

	// Display Back Button if history exists
	if (thoughtHistory.length > 0) {
		$('.previousButton').css('display','block');
	}

	if (debug) {
		console.log("History: " + thoughtHistory);
	}
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
	ready = false;
	postRequest = sendRequest({
		type:"post",
		idToken: id_token,
		text: text
	});
	postRequest.done(function() {
		result = JSON.parse(thoughtRequest.responseText).result;
		$("#newThoughtText").val("");
		$('#postThoughtFeedback').text("Success!");
		$('#postThoughtFeedback').fadeIn(1000).fadeOut(3000);
		ready = true;
	});
};

// Voting Interface
// Toggles a vote state and updates the view
function voteToggle(voteType) {
	userVotes[voteType] = userVotes[voteType] == 1 ? 0 : 1;
	updateVotes();
}

// Updates the display of votes
function updateVotes() {
	$(".voteFunny > .voteCount").html(totalVotes.funny + userVotes.funny)
	$(".voteDeep > .voteCount").html(totalVotes.deep + userVotes.deep)
	$(".voteDark > .voteCount").html(totalVotes.dark + userVotes.dark)
	$(".voteDumb > .voteCount").html(totalVotes.dumb + userVotes.dumb)
}

// Send userVotes to the server
function castVote() {
	if (id_token == null) {
		return
	}
	ready = false;
	postRequest = sendRequest({
		type:"vote",
		idToken: id_token,
		votes: userVotes
	});
	postRequest.done(function() {
		result = JSON.parse(thoughtRequest.responseText).result;

		ready = true;
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
	// Click for next anywhere in mainContainer
	$('.nextButton').click(function() {
		if(ready) {
			getThought();
		}
	});

	$('.previousButton').click(function() {
		if(ready) {
			getLast();
		}
	});

	// Bind vote buttons
	$('.voteFunny').click(function() {voteToggle('funny')});
	$('.voteDeep').click(function() {voteToggle('deep')});
	$('.voteDark').click(function() {voteToggle('dark')});
	$('.voteDumb').click(function() {voteToggle('dumb')});

	// Add resize positioning bindings
	$( window ).on("resize", function () {
		$('.mainContainer').height($(window).height());
		containerWidth = $('.mainContainer').width();
		containerHeight = $('.mainContainer').height();
		
		$('.previousButton').position({my: "left center", at: "left center", of: ".mainContainer"});
		$('.nextButton').position({my: "right center", at: "right center", of: ".mainContainer"});
		$('.showerThoughtContainer').css('width',(containerWidth - 120)+ 'px')
		$('.showerThoughtContainer').css('max-height',(containerHeight - 300) + 'px');
		$('.showerThoughtContainer').position({my: "center center", at: "center center", of: ".mainContainer"});
	}).trigger('resize');
	$('.previousButton').css('display','none');

	// Get first thought
	getThought();
});

