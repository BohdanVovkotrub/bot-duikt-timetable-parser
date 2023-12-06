## This is Telegram Bot for parsing the lessons schedule from http://e-rozklad.dut.edu.ua/time-table/group?type=0 for your group.

Telegram Bot for parse timetable from http://e-rozklad.dut.edu.ua/time-table/group?type=0 for your academy group. It's works in 2023 until the website is not changed

## Requirements 

* Before launching, you need to register your bot through BotFather and get its API token
* Next, you need to independently find your facultyId, course and groupId on the website http://e-rozklad.dut.edu.ua/time-table/group?type=0

For find facultyId, course and groupId:
1) Go to http://e-rozklad.dut.edu.ua/time-table/group?type=0
2) Open DevTools and select tab "Network"
3) On the web-site select your faculty, course and group
4) In DevTools select filter "All" and find request with name "group?type=0" and click it
5) You will see FormData in Payload tab
6) In this FormData you can see yours facultyId, course and groupId
Done!
For ISDM-53 (2023) facultyId=1; course=5; groupId=928;

## Install on Windows

* Download it and unzip then go to the folder.

* Make settings in the .env file<br>
If there is no .env file, then create it following the example .env.example

* In order for the Bot to work as a Windows service, you need:

0) Download node modules from npm
	```	
	npm install
	```	
1) Copy this BOT-ROZKLAD to drive C and go there.
2) Input in .env the correct path to "spamSubscribers.json" ("C:/bot-rozklad/data/spamSubscribers.json")
3) Install GLOBALLY qckwinsvc2
	```
	npm i qckwinsvc2 -g
	```
	* For Linux you can run it with pm2 (find "pm2" on npmjs.com)
4) Go to the folder "Bin" and run the required batch file.<br>
For the first running you need to run create-service.cmd - that's will create a windows service which you'll see in the Task Manager.


## Usage

After running you can open Telegram.<br>
Go to your bot created with BotFather (which mapped via TELEGRAM_BOT_TOKEN ).<br>
Send ```/start``` <br>
The bot will sent you next instructions: <br>
* You can subscribe/unsubscribe to morning or/and night notifications.
* Night notifications will send you eveny evening about tomorrow's lessons of your group.
* Morning notifications will send you every morning about today's lessons.
* Also this bot will send before 30 min to the lesson notifications.
* Also you can manually see timetable by using received butttons.

Subscriptions writes to data/spamSubscribers.json
