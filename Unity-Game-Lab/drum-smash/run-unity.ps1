param([ValidateSet('Play','Build','Open')][string]$Action='Open')
$ErrorActionPreference='Stop'
$taskProject=$PSScriptRoot
$taskEditor='C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe'
$taskArguments=@('-projectPath',('"'+$taskProject+'"'))
if($Action -eq 'Play') {$taskArguments+=@('-batchmode','-executeMethod','DrumAutomation.CreateAndPlay','-logFile',('"'+(Join-Path $taskProject 'evidence\editor-play.log')+'"'))}
if($Action -eq 'Build') {$taskArguments+=@('-batchmode','-quit','-buildTarget','WebGL','-executeMethod','DrumAutomation.BuildWeb','-logFile',('"'+(Join-Path $taskProject 'evidence\web-build.log')+'"'))}
if($Action -eq 'Open') {Start-Process -FilePath $taskEditor -ArgumentList $taskArguments;return}
$taskProcess=Start-Process -FilePath $taskEditor -ArgumentList $taskArguments -WindowStyle Hidden -PassThru
$taskProcess.WaitForExit()
Write-Output "Unity $Action exit code: $($taskProcess.ExitCode)"
exit $taskProcess.ExitCode
