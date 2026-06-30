//go:build linux

package handlers

import "syscall"

func getFSStats(path string) (totalKB, usedKB, freeKB int64, err error) {
	var stat syscall.Statfs_t
	if err = syscall.Statfs(path, &stat); err != nil {
		return
	}
	totalKB = int64(stat.Blocks) * int64(stat.Bsize) / 1024
	freeKB = int64(stat.Bfree) * int64(stat.Bsize) / 1024
	usedKB = totalKB - freeKB
	return
}
