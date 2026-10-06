param([ValidateSet('Play','Build','Open')][string]$Action='Open')
$ErrorActionPreference='Stop'
$editor='C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe'
$unityArgs=@('-projectPath',('"'+$PSScriptRoot+'"'))
if($Action -ne 'Open'){
    $method=if($Action -eq 'Play'){'CreateAndPlay'}else{'BuildWeb'}
    $unityArgs+=@('-batchmode','-executeMethod',"ShopAutomation.$method",'-logFile',('"'+(Join-Path $PSScriptRoot "evidence/$Action.log")+'"'))
    if($Action -eq 'Build'){$unityArgs+=@('-quit','-buildTarget','WebGL')}
}
$p=Start-Process $editor -ArgumentList $unityArgs -WindowStyle Hidden -PassThru
if($Action -ne 'Open'){$p.WaitForExit();Write-Output "Unity $Action exit: $($p.ExitCode)";exit $p.ExitCode}

