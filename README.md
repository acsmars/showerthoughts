# Shower Thoughts

## Use

This webapp alows users view, submit, and vote on shower thoughts.

Shower thoughts may be viewed by anyone, but only submitted or voted on by authenticated users. Authentication is handled by Google.

Shower Thoughts has a simple interface and can be used on either desktop or mobile platforms.

## Technical

Shower Thoughts is built on a custom Javascript frontend and a Python Flask server backend with a SQLite database.

The server has the following dependencies
* Python Flask 
* oauth2client

The client should run in any modern browser (that supports CSS variables...)

Authentication will require a Google Signon ClIENT_ID for your domain.

## Screenshots

![alt tag](https://raw.githubusercontent.com/acsmars/showerthoughts/master/ShowerThoughts.png)