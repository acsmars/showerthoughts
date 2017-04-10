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
var dayMode = true;

// Communication Functions
function getPrevious() {
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

		// Set Text Area Value
		$("p.showerThoughtText").html(currentThought.text);

		// Update vote counts
		userVotes = currentThought.userVotes;
		initialUserVotes = JSON.parse(JSON.stringify(userVotes)) // Get deep copy of userVotes
		totalVotes = currentThought.totalVotes;
		if (userVotes.funny) {totalVotes.funny -= 1};
		if (userVotes.deep) {totalVotes.deep -= 1};
		if (userVotes.dark) {totalVotes.dark -= 1};
		if (userVotes.dumb) {totalVotes.dumb -= 1};
		updateVotes();

		// Recenter the text window
		$('.showerThoughtContainer').position({my: "center center", at: "center center", of: ".mainContainer"});
		ready = true;
	});

	// Display Back Button if history exists
	if (thoughtHistory.length > 0 && $('.previousButton').css('display') === 'none') {
		$('.previousButton').css('display','block');
		$('.previousButton').position({my: "left center", at: "left center", of: ".mainContainer"});
	}

	if (debug) {
		console.log("History: " + thoughtHistory);
	}
	return thoughtRequest;
};

function postThought() {
	event.preventDefault();
	text = $("#newThoughtText").val();
	if (text == "") {
		return Promise.resolve();
	}
	if (id_token == null) {
		return Promise.resolve();
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
	return postRequest;
};

// Voting Interface
// Toggles a vote state and updates the view
function voteToggle(voteType) {
	if (id_token) {
		userVotes[voteType] = userVotes[voteType] == 1 ? 0 : 1;
		updateVotes();
	}
	else {
		$('#loginModal').modal();
	}
}

// Set vote highlighting
function setVoteHighlight(element,inverted = false) {
	if (inverted) {
		element.addClass('voteInverted');
	}
	else {
		element.removeClass('voteInverted');
	}
}

// Updates the display of votes
function updateVotes() {
	$(".voteFunny > .voteCount").html(totalVotes.funny + userVotes.funny);
	$(".voteDeep > .voteCount").html(totalVotes.deep + userVotes.deep);
	$(".voteDark > .voteCount").html(totalVotes.dark + userVotes.dark);
	$(".voteDumb > .voteCount").html(totalVotes.dumb + userVotes.dumb);

	// Switches vote highlighting if selected
	setVoteHighlight($('.voteFunny'),userVotes.funny);
	setVoteHighlight($('.voteDeep'),userVotes.deep);
	setVoteHighlight($('.voteDark'),userVotes.dark);
	setVoteHighlight($('.voteDumb'),userVotes.dumb);
}

// Send userVotes to the server
function castVote() {
	// Returns a promise
	// Don't vote if not logged in
	if (id_token == null) {
		return Promise.resolve();
	}
	// Don't vote if there's no change
	if (isEquivalent(userVotes,initialUserVotes)) {
		return Promise.resolve();
	}
	ready = false;
	console.log(currentThought.id);
	postRequest = sendRequest({
		type:"vote",
		idToken: id_token,
		votes: userVotes,
		thoughtId: currentThought.id
	});
	postRequest.done(function() {
		result = JSON.parse(thoughtRequest.responseText).result;
		ready = true;
		
	});
	return postRequest;
};

// Google Signon
function onSignIn(googleUser) {
	var profile = googleUser.getBasicProfile();
	id_token = googleUser.getAuthResponse().id_token;

	loginRequest = sendRequest({
		type:"login",
		idToken: id_token
	});
	loginRequest.done(function() {
		$('.postModalButton').attr('data-target','#postModal');
		console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
	});
}

function signOut() {
	var auth2 = gapi.auth2.getAuthInstance();
	auth2.signOut().then(function () {
		console.log('User signed out.');
		$('.postModalButton').attr('data-target','#loginModal');
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

// Helper function to deep check object equivilence
function isEquivalent(a, b) {
	// Create arrays of property names
	var aProps = Object.getOwnPropertyNames(a);
	var bProps = Object.getOwnPropertyNames(b);
	if (aProps.length != bProps.length) { return false; }
	for (var i = 0; i < aProps.length; i++) {
		var propName = aProps[i];
		// If values of same property are not equal,
		// objects are not equivalent
		if (a[propName] !== b[propName]) { return false; }
	}
	return true;
}

function toggleNight() {
	// Toggle Daymode
	dayMode = dayMode ? false : true;
	if (dayMode) {
		document.documentElement.style.setProperty('--color1', 'rgb(250,250,250)');
		document.documentElement.style.setProperty('--color2', 'rgb(230,230,230)');
		document.documentElement.style.setProperty('--color3', 'rgb(200,200,200)');
		document.documentElement.style.setProperty('--color4', 'rgb(170,170,170)');
		document.documentElement.style.setProperty('--color5', 'rgb(140,140,140)');
		document.documentElement.style.setProperty('--textColor', 'rgb(20,20,20)');
	}
	else {
		document.documentElement.style.setProperty('--color1', 'rgb(50,50,50)');
		document.documentElement.style.setProperty('--color2', 'rgb(80,80,80)');
		document.documentElement.style.setProperty('--color3', 'rgb(110,110,110)');
		document.documentElement.style.setProperty('--color4', 'rgb(140,140,140)');
		document.documentElement.style.setProperty('--color5', 'rgb(170,170,170)');
		document.documentElement.style.setProperty('--textColor', 'rgb(200,200,200)');
	}
}

// Bindings
$( document ).ready(function() {
	function nextThought() {
		if(ready) {
			castVote().then(function() {
				getThought();
			});
		}
	};

	function previousThought() {
		if(ready) {
			castVote().then(function() {
				getPrevious();
			});
		}
	};

	$(window).keydown(function (e) {
		switch(e.keyCode) {
			case 39:
				e.preventDefault()
				nextThought();
				break;
			case 37:
				e.preventDefault()
				previousThought();
				break;
		}
	});

	$('.nextButton').click(function() {
		nextThought();
	});

	$('.previousButton').click(function() {
		previousThought();
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

	// Add modal button bindings for ios
	$('[data-toggle]').on('click', function() {
		$(document).trigger('click.zf.trigger', '[data-toggle]');
	});

	// Get first thought
	getThought();

	// Make it night!
	toggleNight();
});

