param(
    [string]$OutputPath = ".private/mercadopago-test-users.json",
    [string]$SiteId = "MLA"
)

$ErrorActionPreference = "Stop"

Write-Host "=== BearDrive - Mercado Pago Test Users ===" -ForegroundColor Cyan
Write-Host "Crea dos usuarios de prueba: Driver y Passenger." -ForegroundColor Gray
Write-Host "El Access Token se usa solo durante esta ejecución y no se guarda." -ForegroundColor Gray
Write-Host ""

$secureToken = Read-Host "Pegá el Access Token de Mercado Pago" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "No se ingresó un Access Token."
    }

    $headers = @{
        Authorization  = "Bearer $token"
        "Content-Type" = "application/json"
        Accept          = "application/json"
    }

    function New-MercadoPagoTestUser {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Description
        )

        $body = @{
            site_id     = $SiteId
            description = $Description
        } | ConvertTo-Json -Compress

        try {
            return Invoke-RestMethod `
                -Method POST `
                -Uri "https://api.mercadopago.com/users/test" `
                -Headers $headers `
                -Body $body
        }
        catch {
            $details = $_.ErrorDetails.Message
            if ([string]::IsNullOrWhiteSpace($details)) {
                $details = $_.Exception.Message
            }
            throw "Mercado Pago rechazó la creación de '$Description': $details"
        }
    }

    Write-Host "Creando usuario Driver..." -ForegroundColor Yellow
    $driver = New-MercadoPagoTestUser -Description "BearDrive Driver Test"

    Start-Sleep -Milliseconds 500

    Write-Host "Creando usuario Passenger..." -ForegroundColor Yellow
    $passenger = New-MercadoPagoTestUser -Description "BearDrive Passenger Test"

    $result = [ordered]@{
        generated_at = (Get-Date).ToUniversalTime().ToString("o")
        site_id      = $SiteId
        warning      = "Archivo privado de pruebas. No subir a Git."
        usage        = [ordered]@{
            driver    = "Usar estas credenciales para autorizar Mercado Pago desde el perfil Driver de BearDrive."
            passenger = "Usar estas credenciales para iniciar sesión en Checkout Pro y pagar un viaje de prueba."
        }
        driver = [ordered]@{
            id       = $driver.id
            nickname = $driver.nickname
            email    = $driver.email
            password = $driver.password
        }
        passenger = [ordered]@{
            id       = $passenger.id
            nickname = $passenger.nickname
            email    = $passenger.email
            password = $passenger.password
        }
    }

    $fullOutputPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
    $outputDir = Split-Path -Parent $fullOutputPath

    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    }

    $result | ConvertTo-Json -Depth 8 | Set-Content -Path $fullOutputPath -Encoding UTF8

    Write-Host ""
    Write-Host "Usuarios creados correctamente." -ForegroundColor Green
    Write-Host "Datos guardados en:" -ForegroundColor Green
    Write-Host "  $fullOutputPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Driver Test ID:    $($driver.id)" -ForegroundColor Cyan
    Write-Host "Passenger Test ID: $($passenger.id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "No subas el archivo generado a GitHub." -ForegroundColor Yellow
}
finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $token = $null
    $secureToken = $null
}
