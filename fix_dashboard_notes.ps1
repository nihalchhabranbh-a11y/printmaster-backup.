$f = 'c:\Users\chhab\OneDrive\Desktop\printmaster\src\src\screens\DashboardScreen.tsx'
$lines = [System.IO.File]::ReadAllLines($f, [System.Text.Encoding]::UTF8)

$newLines = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $lines.Count; $i++) {
    $newLines.Add($lines[$i])
    # After the txnMeta line (which contains INV- and toLocaleDateString), inject desc+notes
    if ($lines[$i] -match 'txnMeta.*INV-.*toLocaleDateString') {
        $newLines.Add('                          {!!(b as any).desc && <Text style={[styles.txnMeta, { marginTop: 1 }]} numberOfLines={1}>{(b as any).desc}</Text>}')
        $newLines.Add('                          {!!(b as any).notes && <Text style={[styles.txnMeta, { fontStyle: "italic", marginTop: 1 }]} numberOfLines={1}>Note: {(b as any).notes}</Text>}')
        Write-Host "Injected desc+notes after line $i"
    }
}

[System.IO.File]::WriteAllLines($f, $newLines.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host "Done! Total lines: $($newLines.Count)"
