from flask import Flask, request, jsonify, render_template, Response, g, session
from oauth2client import client, crypt
import json
import sqlite3
import random

app = Flask(__name__)

# Database Access
DATABASE = "database.db"

# Client ID
CLIENT_ID = "666243270465-6m3elm59e27996amf1jhkvmfpitfvfrp.apps.googleusercontent.com"

def get_db():
	db = getattr(g, '_database', None)
	if db is None:
		db = g._database = sqlite3.connect(DATABASE)
	return db

@app.teardown_appcontext
def close_connection(exception):
	db = getattr(g, '_database', None)
	if db is not None:
		db.close()

# Request Routing
@app.route('/')
def main():
	return render_template('index.html')

@app.route('/data', methods=['POST'])
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
	# Strip email if it got in somehow
	if response.get("email"):
		del response["email"]
	return jsonify(response), 200

# Functions
# def login(data):
# 	response = {}
# 	if not data.get("idToken", None):
# 		return {"verification":"fail"}
# 	token = verifyToken(data.get("idToken"))
# 	return token

def getThought(data):
	response = {}
	category = data.get("category") # string: funny, deep, dark, or dumb
	excludeList = data.get("excludeIds",[]) # List of ids to skip
	requestedThought = data.get("requestedThought",-1)


	# Query database
	try:
		keys = ["id","submitter","text","time","funny","deep","dark","dumb"]
		c = get_db().cursor()
		if requestedThought > -1:
			query = 'SELECT * FROM Thoughts WHERE id = ({}) ORDER BY RANDOM() LIMIT 1'.format(requestedThought)
		else:
			# highestViewSet = genHighestValueSet(alreadyViewed)
			if not excludeList:
				excludeList = [-1]
			excludeList = map(str,excludeList) # Map all values to strings
			query = 'SELECT * FROM Thoughts WHERE id not in ({}) ORDER BY RANDOM() LIMIT 1'.format(', '.join(excludeList))
		thought = c.execute(query).fetchone()
		if not thought:
			query = 'SELECT * FROM Thoughts ORDER BY RANDOM() LIMIT 1'
			thought = c.execute(query).fetchone()
	except Exception as ex:
		raise Exception("SQL error fetching thought:" + str(ex))

	# Pick a thought for the client
	try:
		if not thought:
			raise Exception("No matching thought")
		response = dict(zip(keys, thought))
		if response.get("submitter"):
			del response["submitter"]
		response["result"] = "success"
	except Exception as ex:
		raise Exception("Error selecting a thought: " + str(ex))

	return response

def vote(data):
	response = {}
	return response

def postThought(data):
	if not data.get("idToken", None):
		return {"verification":"fail"}
	token = verifyToken(data.get("idToken"))
	if token.get("verification","fail") == "fail":
		return {"verification":"fail"}
	# Add Thought to Table
	try:
		c = get_db().cursor()
		c.execute('INSERT INTO Thoughts (submitter,text) VALUES ("{}","{}")'.format(token.get("email"),data.get("text")))
		get_db().commit()
	except Exception as ex:
		raise Exception("Error inserting a thought: " + str(ex))
	return {"result":"success"}

def verifyToken(token):
	try:
		idinfo = client.verify_id_token(token, CLIENT_ID)
		email = idinfo["email"]
	except Exception as ex:
		return {"email":None,"verification":"fail"}
	return {"email":email,"verification":"pass","result":"success"}


if __name__ == '__main__':
	app.run(debug=True,host='0.0.0.0')