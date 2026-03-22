# Code Signing — Enput VPS Manager

This document explains how to set up code signing so installers don't trigger
OS security warnings (Windows SmartScreen, macOS Gatekeeper).

---

## Why code signing?

| Without signing | With signing |
|---|---|
| Windows SmartScreen blocks or warns on every install | No SmartScreen warning |
| macOS says "app can't be opened because it is from an unidentified developer" | Gatekeeper passes; app opens normally |
| Users must manually bypass security dialogs | One-click install experience |

---

## Windows

### 1. Get a certificate

You need an **OV (Organization Validation)** or **EV (Extended Validation)**
code signing certificate from a trusted CA.

Recommended CAs: Sectigo, DigiCert, GlobalSign, SSL.com

- **OV certificate** (~$70–$200/year): Removes SmartScreen after your app
  builds reputation over time (typically after ~5,000 downloads).
- **EV certificate** (~$300–$500/year): Removes SmartScreen immediately on
  first install. Requires a hardware token (USB HSM).

### 2. Export your certificate as a .pfx file

```bash
# Convert PEM + key to PFX (if you received separate files from CA)
openssl pkcs12 -export -out cert.pfx -inkey private.key -in certificate.crt -certfile chain.crt
```

### 3. Set environment variables

```bash
# Encode the .pfx as base64
base64 -w 0 cert.pfx > cert.pfx.b64

# Add to GitHub Secrets (Settings → Secrets → Actions):
#   WIN_CSC_LINK            ← paste the base64 string
#   WIN_CSC_KEY_PASSWORD    ← the password you set when exporting

# For local builds, set them in your shell:
export WIN_CSC_LINK="$(base64 -w 0 cert.pfx)"
export WIN_CSC_KEY_PASSWORD="your-pfx-password"
npm run dist:win
```

### 4. Azure Trusted Signing (alternative for EV without HSM)

Microsoft's [Azure Trusted Signing](https://azure.microsoft.com/en-us/products/trusted-signing/)
lets you EV-sign without a physical token. Uncomment the Azure block in
`electron-builder.yml` and `build.yml`, then add:

```
AZURE_TENANT_ID
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_CODE_SIGNING_ACCOUNT_NAME
AZURE_CODE_SIGNING_ENDPOINT
AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME
```

---

## macOS

### 1. Join Apple Developer Program

Enroll at https://developer.apple.com ($99/year).

### 2. Create a "Developer ID Application" certificate

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click **+** → choose **Developer ID Application**
3. Follow the Certificate Signing Request (CSR) steps using Keychain Access
4. Download and install the certificate

### 3. Export the certificate as a .p12

1. Open **Keychain Access**
2. Find your "Developer ID Application: Your Name (XXXXXXXXXX)" certificate
3. Right-click → **Export** → choose `.p12` format → set a password

### 4. Set environment variables

```bash
# Encode the .p12 as base64
base64 -w 0 cert.p12 > cert.p12.b64

# Add to GitHub Secrets:
#   CSC_LINK                     ← paste the base64 string
#   CSC_KEY_PASSWORD             ← the password you set when exporting
#   APPLE_ID                     ← your Apple ID email
#   APPLE_APP_SPECIFIC_PASSWORD  ← create at https://appleid.apple.com → App-Specific Passwords
#   APPLE_TEAM_ID                ← 10-char ID shown in your developer account

# For local builds:
export CSC_LINK="$(base64 -w 0 cert.p12)"
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist:mac
```

### 5. Notarization

The `notarize: true` option in `electron-builder.yml` handles notarization
automatically when the above env vars are present. This uploads your signed
app to Apple's servers and staples the notarization ticket, which is required
for macOS 10.15+ distribution outside the App Store.

The macOS build takes longer than usual (~5–10 minutes) when notarizing.

---

## Linux

Linux doesn't have a centralized code signing requirement. AppImage and .deb
packages are shipped as-is. If you want to verify package integrity, you can
optionally GPG-sign the release assets after building.

---

## Building locally (without CI)

```bash
# Build + package for your current platform
npm run release

# Build for a specific platform (Windows on Windows, macOS on macOS, etc.)
npm run release:win    # Windows only
npm run release:mac    # macOS only
npm run release:linux  # Linux only
```

Output is in the `release/` directory.

## Building a release via GitHub Actions

1. Push a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. The `build.yml` workflow triggers automatically and:
   - Builds for Windows, macOS, and Linux in parallel
   - Signs each platform's artifacts using the stored secrets
   - Creates a draft GitHub Release with all installers attached

3. Edit the draft release on GitHub to add release notes, then publish.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No identity found` on macOS | The CSC_LINK secret is missing or the P12 password is wrong |
| SmartScreen still shows on Windows | You need more download volume (OV) or an EV cert |
| Notarization times out | Check Apple System Status; retry the build |
| `ENOENT: icon.icns` | Run `npm run icons` first, or build on macOS so iconutil runs |
