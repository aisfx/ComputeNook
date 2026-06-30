APP=hpc-rdp-client

.PHONY: all windows linux mac tidy

all: tidy windows linux mac

tidy:
	go mod tidy

windows:
	GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui" -o dist/$(APP)-windows.exe .

linux:
	GOOS=linux GOARCH=amd64 go build -o dist/$(APP)-linux .

mac:
	GOOS=darwin GOARCH=amd64 go build -o dist/$(APP)-mac-amd64 .
	GOOS=darwin GOARCH=arm64 go build -o dist/$(APP)-mac-arm64 .
	lipo -create -output dist/$(APP)-mac dist/$(APP)-mac-amd64 dist/$(APP)-mac-arm64
	rm dist/$(APP)-mac-amd64 dist/$(APP)-mac-arm64

run:
	go run .
