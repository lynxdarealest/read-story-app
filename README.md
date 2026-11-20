# VBook Desktop

## Windows releases and auto-updates

The Windows installer checks the public GitHub Releases page when VBook starts. It downloads available updates automatically and installs them after VBook exits.

To publish an update, push a version tag such as `v0.1.1`:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions builds the NSIS installer and publishes it with the update metadata. Keep releases public so installed copies can download them. The first release is `v0.1.0`; later releases must use a higher version.
