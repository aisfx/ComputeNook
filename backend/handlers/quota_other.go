//go:build !linux

package handlers

import "fmt"

func getFSStats(path string) (totalKB, usedKB, freeKB int64, err error) {
	err = fmt.Errorf("getFSStats not supported on this platform")
	return
}
