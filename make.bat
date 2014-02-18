@echo off

set REPORTER=dot

if "%1"=="" goto serve
if "%1"=="serve" goto serve
if "%1"=="servep" goto servep
if "%1"=="run" goto run
if "%1"=="test" goto test
if "%1"=="test-w" goto test-w

echo make: *** No rule to make target `%1'.  Stop.
goto exit

:serve
    node bin/repopad serve 4000 ./tmp/repo
    goto exit

:servep
    node bin/repopad serve %2 ./tmp/repo
    goto exit

:run
    node bin/repopad %2 %3 %4 %5 %6
    goto exit

:test
    IF EXIST "test/output" (
      rmdir /S /Q "test/output"
    )
    ./node_modules/.bin/mocha --reporter %REPORTER%
    goto exit

:test-w
  IF EXIST "test/output" (
    rmdir /S /Q "test/output"
  )
  ./node_modules/.bin/mocha --reporter %REPORTER% --growl --watch
  goto exit
:exit
