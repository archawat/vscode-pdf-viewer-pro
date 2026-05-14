version := `node -p "require('./package.json').version"`
vsix := "pdf-viewer-pro-" + version + ".vsix"

install:
    pnpm run build
    code --install-extension {{vsix}} --force
