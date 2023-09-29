This is Telegram Bot for parsing the lessons schedule from http://e-rozklad.dut.edu.ua/time-table/group?type=0 for your group.

Before launching, you need to register your bot through BotFather and get its API token
Next, you need to independently find your facultyId, course and groupId on the website http://e-rozklad.dut.edu.ua/time-table/group?type=0

For find facultyId, course and groupId:
1) Go to http://e-rozklad.dut.edu.ua/time-table/group?type=0
2) Open DevTools and select tab "Network"
3) On the web-site select your faculty, course and group
4) In DevTools select filter "All" and find request with name "group?type=0" and click it
5) You will see FormData in Payload tab
6) In this FormData you can see yours facultyId, course and groupId
Done!
For ISDM-53 (2023) facultyId=1; course=5; groupId=928;


Make settings in the .env file
If there is no .env file, then create it following the example .env.example


In order for the Bot to work as a Windows service, you need:

0) Download node modules from npm
	
	npm install
	
1) Copy this BOT-ROZKLAD to drive C and go there.
2) Input in .env the correct path to "spamSubscribers.json" ("C:/bot-rozklad/data/spamSubscribers.json")
3) Install GLOBALLY qckwinsvc2

     npm i qckwinsvc2 -g

4) Go to the folder "Bin" and run the required batch file
