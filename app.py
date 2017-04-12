from flask import Flask, request, jsonify, render_template, Response, g, session
from oauth2client import client, crypt
import json
import sqlite3
import random
import time

app = Flask(__name__)

# Database Access
DATABASE = "database.db"

# Client ID
CLIENT_ID = "666243270465-6m3elm59e27996amf1jhkvmfpitfvfrp.apps.googleusercontent.com"

def get_db():
	db = getattr(g, "_database", None)
	if db is None:
		db = g._database = sqlite3.connect(DATABASE)
	return db

@app.teardown_appcontext
def close_connection(exception):
	db = getattr(g, "_database", None)
	if db is not None:
		db.close()

# Request Routing
@app.route("/")
# Main page and static content
def main():
	return render_template("index.html")

@app.route("/data", methods=["POST"])
# Main data request handler
def post():
	try:
		# Attempt to parse data
		try:
			data = request.get_json()
		except Exception as ex:
			raise Exception("Request data could not be decoded: " + str(ex))

		# Interpret request and generate response
		requestType = data.get("type")
		if not requestType:
			raise Exception("Request must have a type attribute")
		if requestType == "login":
			response = login(data)
		elif requestType == "new":
			response = getThought(data)
		elif requestType == "vote":
			response = vote(data)
		elif requestType == "post":
			response = postThought(data)
		else:
			raise Exception("Invalid request type")
	except Exception as ex:
		print(str(ex))
		return jsonify({"exception":str(ex)}), 400
	return jsonify(response), 200

def getThought(data):
	# Fetch a thought
	# If a specific thought is requested, that one will be returned
	# If that thought does not exist or is not supplied a random thought not on the eclusion list will be returned
	# If no thoughts not on the eclusion list exist, a random one on the exclusion list will be returned
	response = {}
	excludeList = data.get("excludeIds",[]) # List of ids to skip
	requestedThought = data.get("requestedThought",-1)
	token = None

	# Logged in user. If token is not None after this, user is verified
	if data.get("idToken", None):
		token = verifyToken(data.get("idToken"))
		if token.get("verification","fail") == "fail":
			token = None


	# Query database
	try:
		c = get_db().cursor()
		if requestedThought > -1:
			query = 'SELECT * FROM Thoughts WHERE id = ({})'.format(requestedThought)
		else:
			# If nothing is excluded, exclude -1 for SQL legality reasons
			if not excludeList: excludeList = [-1]

			# Map all exclusion IDs to strings
			excludeList = map(str,excludeList) 
			query = 'SELECT * FROM Thoughts WHERE id not in ({}) ORDER BY RANDOM() LIMIT 1'.format(", ".join(excludeList))
		thought = c.execute(query).fetchone()
		# If no thought fits exclusions or request, get a random one
		if not thought:
			query = "SELECT * FROM Thoughts ORDER BY RANDOM() LIMIT 1"
			thought = c.execute(query).fetchone()
	except Exception as ex:
		raise Exception("SQL error fetching thought:" + str(ex))

	# Pick a thought for the client
	try:
		if not thought: 
			raise Exception("No thoughts")

		# Convert list from sql to dictionary
		thoughtKeys = ["id","submitter","text","time","funny","deep","dark","dumb"]
		thought = dict(zip(thoughtKeys, thought)) 
		response["id"] = thought.get("id")
		response["text"] = thought.get("text")
		response["time"] = thought.get("time")
		response["totalVotes"] = {"funny":thought.get("funny",0),"deep":thought.get("deep",0),"dark":thought.get("dark",0),"dumb":thought.get("dumb",0)};

		# Vote information processing
		# User is logged in
		if token:
			try:
				query = 'SELECT * FROM Votes WHERE id = "{}" AND submitter = "{}" LIMIT 1'.format(thought.get("id"),token.get("email"))
				userVote = c.execute(query).fetchone()
				if userVote:
					voteKeys = ["id","submitter","funny","deep","dark","dumb"]
					userVote = dict(zip(voteKeys, userVote))
					response["userVotes"] = userVote
				else:
					response["userVotes"] = {"funny":0,"deep":0,"dark":0,"dumb":0};
			except Exception as ex:
				raise Exception("SQL error fetching vote" + str(ex))

		# User is not logged in
		else:
			# Logged out users have no votes
			response["userVotes"] = {"funny":0,"deep":0,"dark":0,"dumb":0};

		response["result"] = "success"
	except Exception as ex:
		raise Exception("Error selecting a thought: " + str(ex))

	return response

def vote(data):
	# Attempt to cast a vote
	# Authenticate
	if not data.get("idToken", None):
		return {"verification":"fail"}
	token = verifyToken(data.get("idToken"))
	if token.get("verification","fail") == "fail":
		return {"verification":"fail"}
	# Process vote data
	submitter = token.get("email")
	ID = data.get("thoughtId")
	votes = data.get("votes")
	updateVoteEntry(ID,submitter,votes.get("funny"),votes.get("deep"),votes.get("dark"),votes.get("dumb"))
	response = {"result":"success"}
	return response

def postThought(data):
	# Attempt to post a thought
	# Authenticate
	if not data.get("idToken", None):
		return {"verification":"fail"}
	token = verifyToken(data.get("idToken"))
	if token.get("verification","fail") == "fail":
		return {"verification":"fail"}
	# Add Thought to Table
	try:
		c = get_db().cursor()
		query = 'INSERT INTO Thoughts (submitter,text) VALUES ("{}","{}")'.format(token.get("email"),data.get("text"))
		c.execute(query)
		get_db().commit()
	except Exception as ex:
		raise Exception("Error inserting a thought: " + str(ex))
	return {"result":"success"}

def login(data):
	# Validates a login
	if not data.get("idToken", None):
		return {"verification":"fail"}
	token = verifyToken(data.get("idToken"))
	if token.get("verification","fail") == "fail":
		return {"verification":"fail"}
	return {"result":"success"}

def verifyToken(token):
	# Verifies a user token
	try:
		idinfo = client.verify_id_token(token, CLIENT_ID)
		email = idinfo["email"]
	except Exception as ex:
		return {"email":None,"verification":"fail"}
	return {"email":email,"verification":"pass","result":"success"}

def updateVoteEntry(ID,submitter,funny,deep,dark,dumb):
	# Updates a vote entry and applicable thought
	c = get_db().cursor()
	# Fetch existing vote
	query = 'SELECT * FROM Votes WHERE submitter = "{submitter}" AND id = {ID}'.format(ID = ID, submitter = submitter)
	oldUserVote = c.execute(query).fetchone()

	# Update of an existing vote
	if oldUserVote:
		voteKeys = ["id","submitter","funny","deep","dark","dumb"]
		oldUserVote = dict(zip(voteKeys, oldUserVote))
		# Calculate vote change
		funnyDif = funny - oldUserVote.get("funny")
		deepDif = deep - oldUserVote.get("deep")
		darkDif = dark - oldUserVote.get("dark")
		dumbDif = dumb - oldUserVote.get("dumb")

		# Update vote if not all 0s
		if (funny or deep or dark or dumb):
			query = 'UPDATE Votes SET funny = "{funny}", deep = "{deep}", dark = "{dark}", dumb = "{dumb}" WHERE submitter = "{submitter}" AND id = {ID};'.format(ID = ID, submitter = submitter, funny = funny, deep = deep, dark = dark, dumb = dumb)
			c.execute(query)
		# Delete vote if all 0s
		else:
			query = 'DELETE FROM Votes WHERE submitter = "{submitter}" AND id = {ID};'.format(ID = ID, submitter = submitter)
			c.execute(query)

		# Update thought
		if (funnyDif or deepDif or darkDif or dumbDif):
			query = 'UPDATE Thoughts SET funny = funny + {funnyDif}, deep = deep + {deepDif}, dark = dark + {darkDif}, dumb = dumb + {dumbDif} WHERE id = {ID};'.format(ID = ID, funnyDif = funnyDif, deepDif = deepDif, darkDif = darkDif, dumbDif = dumbDif)
			c.execute(query)
		get_db().commit()

	# New vote
	else:
		# Insert and update thought tally if not 0s
		if (funny or deep or dark or dumb):
			query = 'INSERT INTO Votes (id, submitter, funny, deep, dark, dumb) VALUES ("{ID}","{submitter}","{funny}","{deep}","{dark}","{dumb}");'.format(ID = ID, submitter = submitter, funny = funny, deep = deep, dark = dark, dumb = dumb)
			c.execute(query)

			# Update thought
			query = 'UPDATE Thoughts SET funny = funny + {funny}, deep = deep + {deep}, dark = dark + {dark}, dumb = dumb + {dumb} WHERE id = {ID};'.format(ID = ID, funny = funny, deep = deep, dark = dark, dumb = dumb)
			c.execute(query)
			get_db().commit()

if __name__ == "__main__":
	app.run(host="node.acsmars.com")