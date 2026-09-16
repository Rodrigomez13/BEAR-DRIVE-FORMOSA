param([ValidateSet('apk','bundle')][string]$Target='apk')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $env:JAVA_HOME -and (Test-Path "$env:USERPROFILE/.jdks/jbr-21.0.11")) { $env:JAVA_HOME="$env:USERPROFILE/.jdks/jbr-21.0.11" }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME="$env:LOCALAPPDATA/Android/Sdk" }
if (-not (Test-Path "$env:JAVA_HOME/bin/java.exe")) { throw 'Configura JAVA_HOME con JDK 21.' }
$env:PATH="$env:JAVA_HOME/bin;$env:PATH"
if ($Target -eq 'bundle' -and -not (Test-Path 'android/keystore.properties')) { throw 'Falta android/keystore.properties para firmar el AAB. Ver docs/android-release.md.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Fallo build web' }
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Fallo sync Android' }
Push-Location android
try {
 $task=if($Target -eq 'bundle'){'bundleRelease'}else{'assembleDebug'}
 ./gradlew.bat $task
 if ($LASTEXITCODE -ne 0) { throw 'Fallo Gradle' }
} finally { Pop-Location }
New-Item -ItemType Directory -Force artifacts | Out-Null
$source=if($Target -eq 'bundle'){'android/app/build/outputs/bundle/release/app-release.aab'}else{'android/app/build/outputs/apk/debug/app-debug.apk'}
$destination=if($Target -eq 'bundle'){'artifacts/BearDrive-release.aab'}else{'artifacts/BearDrive-prueba.apk'}
Copy-Item -LiteralPath $source -Destination $destination -Force
$sha = [System.Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes((Resolve-Path $destination)))).Replace('-',''); $hash | Set-Content "$destination.sha256" } finally { $sha.Dispose() }
Write-Output "Generado: $destination"
