@echo off

cd %cd%
cd ..

set scriptPath=%cd%

qckwinsvc2 install name="BOBOS-TgBot-DUIKT-EROZKLAD-v1.0.0" description="BOBOS-TgBot-DUIKT-EROZKLAD-v1.0.0" path="%scriptPath%\index.js" args="" now

pause