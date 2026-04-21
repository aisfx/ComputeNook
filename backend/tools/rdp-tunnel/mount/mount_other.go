//go:build !windows

package mount

import "fmt"

func mountWindows(port int, driveLetter string) error {
	return fmt.Errorf("mountWindows not supported on this platform")
}
