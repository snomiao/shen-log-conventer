REM Last Change 15.09.2021 (STei)
REM
REM This Script needs the Files uzcomp.exe in C:\usr2\syscon\bin\Tools
REM Zips all logs from the Machinefolder (Use "full" Parameter to include L????? Logs)
REM
REM *******************************************************************************************************
REM uzcomp parmeters
REM
REM   uzcomp [-commands] [-options] [c:\path\]archivefile [files ...]
REM Commands:
REM    a           : add files to archive (default)
REM    u           : update files to archive
REM    m           : move files to archive (files only)
REM    d           : delete files from archive
REM Options:
REM    r           : recurse subdirectories
REM    p|P         : store relative Pathnames|store full Pathnames
REM    c<0..2>     : set compression level (0-store;1-normal;2-maximal)
REM    s<password> : protect with password(Zip only)
REM    e<0..2>     : set ecryption method (0-Zipv2(default);1-AES128;2-AES256)
REM    o           : store date using the current system's date
REM    w           : include system and hidden files
REM    @list       : specify list of files for compression
REM    x<file>     : exclude specified file from adding
REM    x@list      : exclude file(s) in specified list file from adding
REM *******************************************************************************************************
setlocal EnableDelayedExpansion

@echo off
cls
set PATH=%PATH%;%syscon%\syscon\bin\tools;
set LogZipPath=%~f0
set LogZipTool=uzcomp.exe -a -c2 -P

if not exist %syscon%\syscon\bin\Tools\uzcomp.exe goto error

REM Create Shortcut
echo Set oShell                   = CreateObject("WScript.Shell")                                                     >"%tmp%\create_logzip_shortcut.vbs"
echo sCurrentUsersDesktopPath     = oShell.SpecialFolders("StartMenu")                                               >>"%tmp%\create_logzip_shortcut.vbs"
echo sWinSysDir                   = oShell.ExpandEnvironmentStrings("%%SystemRoot%%\System32")                       >>"%tmp%\create_logzip_shortcut.vbs"
echo Set oShortCut                = oShell.CreateShortcut(sCurrentUsersDesktopPath ^& "\Copy LogFiles.lnk")          >>"%tmp%\create_logzip_shortcut.vbs"
echo oShortCut.TargetPath         = "%LogZipPath%"                                                                   >>"%tmp%\create_logzip_shortcut.vbs"
echo oShortCut.IconLocation       = sWinSysDir ^& "\Shell32.dll,171"                                                 >>"%tmp%\create_logzip_shortcut.vbs"
echo oShortCut.Description        = "Create machine logfiles.zip to teleservice folder"                              >>"%tmp%\create_logzip_shortcut.vbs"
echo oShortCut.Save                                                                                                  >>"%tmp%\create_logzip_shortcut.vbs"
cscript "%tmp%\create_logzip_shortcut.vbs"
del /q  "%tmp%\create_logzip_shortcut.vbs"


REM Search teleservice directory
set teleservice=FALSE
if exist C:\teleservice          set teleservice=C:\teleservice
if exist %syscon%\teleservice    set teleservice=%syscon%\teleservice
if "%teleservice%" equ "FALSE"   set teleservice=C:\teleservice

if not exist %teleservice% mkdir %teleservice%
net share teleservice=%teleservice%     /GRANT:syscon,Change     /GRANT:Administrator,Change /remark:"Salvagnini Updates" >>NUL 2>&1

REM Search Machinefolder
set machine=FALSE

for /d %%m in (ACN C4 CP CPR DOC ES L L1 L2 L3 L4 L5 MB MC MCL ME MV MVL P2 P4 P4M S1 S2 S4 S4L S4S S4Y SAR SL4 SMD SMD1 SMD2 SP4 TB TE TX WMS WSS) do (
    if exist "%syscon%\syscon\%%m_*" for /f "tokens=1 delims=" %%a in ('dir /b /ad %syscon%\syscon ^|find "%%m"') do (
        set machine_typ=%%m
        set machine=%%a
        if /i "!machine:~-4!" neq "HYDR" if "!machine:~0,2!" equ "!machine_typ:~0,2!" call :logzip_machine
    )
)
if "%machine%" equ "FALSE" goto error:
goto end:

:logzip_machine
    Title  Create LogZip for %machine%

    REM Create Process-Logfiles
    set pu_list=FALSE
    if exist "%SYSCON%\syscon\bin\Tools\pslist.exe"                     set pu_list=%SYSCON%\syscon\bin\Tools\pslist.exe
    if exist "%SYSCON%\SysconSoftwareSupport\SysInternals\pslist.exe"   set pu_list=%SYSCON%\SysconSoftwareSupport\SysInternals\pslist.exe

    if "%pu_list%" equ "FALSE" (
        pulist >"%SYSCON%\syscon\%machine%\scsfiles\log\pulist.log"
    ) else (
        if exist "%windir%\system32\reg.exe" reg add "HKEY_CURRENT_USER\Software\Sysinternals\PsList" /v "EulaAccepted" /t REG_DWORD /d 1 /f /reg:64
        %pu_list% -t >"%SYSCON%\syscon\%machine%\scsfiles\log\pulist.log"
    )

    REM Save Network Routing Infos
    route print >"%SYSCON%\syscon\%machine%\scsfiles\log\route_print.log"

    REM Create TBX-Logfiles
    if /i "%machine_typ%" equ "P4M" if exist "%SYSCON%\syscon\bin\Tools\tbx.exe" (
        for /f "tokens=1 delims= " %%i in ('tasklist ^|find /i "smdsp.exe"') do if /i "%%i" equ "smdsp.exe" (
            echo Create TBX Logfile, please wait...
            tbx.exe               >"%SYSCON%\syscon\%machine%\scsfiles\log\tbx.log"
            tbx.exe -full         >"%SYSCON%\syscon\%machine%\scsfiles\log\tbx_full.log"
            tbx.exe -taskdump
        ) else (
            if exist "%SYSCON%\syscon\%machine%\scsfiles\log\tbx.log"       del /q "%SYSCON%\syscon\%machine%\scsfiles\log\tbx.log"
            if exist "%SYSCON%\syscon\%machine%\scsfiles\log\tbx_full.log"  del /q "%SYSCON%\syscon\%machine%\scsfiles\log\tbx_full.log"
            if exist "%SYSCON%\syscon\%machine%\scsfiles\log\tbx_task.log"  del /q "%SYSCON%\syscon\%machine%\scsfiles\log\tbx_task.log"
        )
    )

    REM Set the actual Date and Time
    for /f  %%i in ('wmic os get LocalDateTime ^|find "2"') do set wmic_date=%%i
    if "%wmic_date:~0,1%" equ "2" (
        set current_date=%wmic_date:~6,2%.%wmic_date:~4,2%.%wmic_date:~0,4%
        set current_time=%wmic_date:~8,2%-%wmic_date:~10,2%
    ) else (
        if "%date:~6,1%" equ "/" (set current_date=%date:~7,2%.%date:~4,2%.%date:~10,4%) else (set current_date=%date:~0,2%.%date:~3,2%.%date:~6,4%)
        set current_time=%time:~0,2%-%time:~3,2%
    )

    REM Zip all Logfiles to teleservie
    set LogZipFileName=%machine%_logfiles_(%current_date%_%current_time%).zip
    echo.
    Title Create %LogZipFileName%
    echo  Create %LogZipFileName% in %teleservice%
    echo.

    REM Zip FACE Console LogFiles
    for /d %%h in (S1Console ACNConsole LaserConsole P2Console P4Console PressConsole PunchConsole) do (
        if exist "%SYSCON%\syscon\bin\%%h" (
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\*.dbg"
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\*.err"
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\*.log"
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\*.config
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\loj_*.dat"
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\args_*.dat"
            %LogZipTool% "%teleservice%\%LogZipFileName%"    "%SYSCON%\syscon\bin\%%h\Logs\log.txt
        )
    )

    REM Zip only LogFiles from today
    forfiles /P "%SYSCON%\syscon\%machine%\scsfiles\LogEx"          /M *Memory_NLog.*        /D 0 /c "cmd /c %LogZipTool% "%teleservice%\%LogZipFileName%" @path"
    forfiles /P "%SYSCON%\syscon\%machine%\scsfiles\LogEx"          /M *WMSFaceShell_NLog.*  /D 0 /c "cmd /c %LogZipTool% "%teleservice%\%LogZipFileName%" @path"
    forfiles /P "%SYSCON%\syscon\%machine%\scsfiles\LogEx"          /M *Console*.*           /D 0 /c "cmd /c %LogZipTool% "%teleservice%\%LogZipFileName%" @path"
    forfiles /P "%SYSCON%\syscon\%machine%\scsfiles\LogEx\CDS_bck"  /M *.*                   /D 0 /c "cmd /c %LogZipTool% "%teleservice%\%LogZipFileName%" @path"
    forfiles /P "%SYSCON%\syscon\%machine%\scsfiles\Events"         /M *.*                   /D 0 /c "cmd /c %LogZipTool% "%teleservice%\%LogZipFileName%" @path"

    REM Zip Machine LogFiles
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\conf\ctm.mdb"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\conf\conta.ora"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\conf\tooldat.ini"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\mm_db\mm.mdb"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\sm_db\*.tdb"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\wms_db\*.mdb"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\scs_db\status.info"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\scs_config\*.ini"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\scs_config\*.xml"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\log\*.log"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\LogEx\*.log"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\LogEx\*Memory_NLog*.log"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\LogEx\*Console_NLog*.log"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\stacker\*.ini"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\stacker_PUNCH\*.ini"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\stacker_BEND\*.ini"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\scsfiles\CM\*.ini"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\rtsoft\exe\exe.info"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\%machine%\rtsoft\exe\svn_info.txt"

    REM Zip bin LogFiles
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\LogEx\*.log"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\salvagnini.ini"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\plugins\*.map"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.log"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.err"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.dbg"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.out"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.ini"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\*.dat"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\SCONCrashMiniDump.dmp"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\communic\*.dbg"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\communic\*.err"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\SCON\communic\*.out"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\CDS\*.log"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\CDS\*.err"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\CDS\*.dbg"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\CMServer\*.err"
    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\CMServer\*.dbg"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\TXSServer\*.dbg"

    %LogZipTool% "%teleservice%\%LogZipFileName%"            "%SYSCON%\syscon\bin\OPS\Logs\*.log"

    if not exist "%teleservice%\%LogZipFileName%" goto error:
    echo.
goto end:

:error
    color 0c
    echo.
    if not exist %syscon%\syscon\bin\Tools\uzcomp.exe echo No %syscon%\syscon\bin\Tools\uzcomp.exe found !!!
    if /i "%machine%" equ "FALSE" echo NO MACHINE FOUND !!!
    echo.
    pause
goto end:


:end
endlocal
