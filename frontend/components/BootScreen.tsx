import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";

type BootScreenProps = {
  onDone: () => void;
};

type Phase = "boot";

const RAW_BOOT_LOG = `Loading Linux /vmlinuz-linux ...
Loading initial ramdisk /initramfs-linux.img ...
[    0.000000] Linux version 6.9.0-arch1-1 (linux@archlinux) (gcc (GCC) 14.1.1 20240507, GNU ld (GNU Binutils) 2.42.0) #1 SMP PREEMPT_DYNAMIC Thu, 23 May 2024 18:15:20 +0000
[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-linux root=UUID=3c7e2a4f-9b1d-4e8a-a3c2-7f8e4d2b1a9c rw loglevel=3 quiet
[    0.000000] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'
[    0.000000] x86/fpu: Supporting XSAVE feature 0x002: 'SSE registers'
[    0.000000] x86/fpu: Supporting XSAVE feature 0x004: 'AVX registers'
[    0.000000] x86/fpu: xstate_offset[2]:  576, xstate_sizes[2]:  256
[    0.000000] x86/fpu: Enabled xstate features 0x7, context size is 832 bytes
[    0.000000] signal: max sigframe size: 1776
[    0.000000] BIOS-provided physical RAM map:
[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009efff] usable
[    0.000000] BIOS-e820: [mem 0x000000000009f000-0x00000000000fffff] reserved
[    0.000000] BIOS-e820: [mem 0x0000000000100000-0x00000000cafbefff] usable
[    0.000000] BIOS-e820: [mem 0x00000000cafbf000-0x00000000cd98efff] reserved
[    0.000000] NX (Execute Disable) protection: active
[    0.000000] efi: EFI v2.70 by American Megatrends
[    0.000000] SMBIOS 3.3.0 present.
[    0.000000] DMI: ASUS ROG Zephyrus G14 GA401QM/GA401QM, BIOS GA401QM.316 03/21/2024
[    0.000000] tsc: Fast TSC calibration using PIT
[    0.000000] tsc: Detected 3294.789 MHz processor
[    0.000004] e820: update [mem 0x00000000-0x00000fff] usable ==> reserved
[    0.000011] last_pfn = 0x22f000 max_arch_pfn = 0x400000000
[    0.000267] Using GB pages for direct mapping
[    0.000741] Secure boot disabled
[    0.000742] RAMDISK: [mem 0x36b2e000-0x37a8efff]
[    0.006466] Zone ranges:
[    0.006467]   DMA      [mem 0x0000000000001000-0x0000000000ffffff]
[    0.006469]   DMA32    [mem 0x0000000001000000-0x00000000ffffffff]
[    0.013767] ACPI: PM-Timer IO Port: 0x808
[    0.013843] IOAPIC[0]: apic_id 9, version 33, address 0xfec00000, GSI 0-23
[    0.019874] setup_percpu: NR_CPUS:320 nr_cpumask_bits:16 nr_cpu_ids:16 nr_node_ids:1
[    0.021597] Dentry cache hash table entries: 2097152 (order: 12, 16777216 bytes)
[    0.022194] Inode-cache hash table entries: 1048576 (order: 11, 8388608 bytes)
[    0.056936] Memory: 8192528K/8388608K available (16384K kernel code, 2135K rwdata, 13248K rodata, 3396K init, 3452K bss, 196080K reserved)
[    0.065688] rcu: Preemptible hierarchical RCU implementation.
[    0.069942] printk: console [tty0] enabled
[    0.076676] pid_max: default: 32768 minimum: 301
[    0.078709] landlock: Up and running.
[    0.079133] CPU0: Thermal monitoring enabled (TM1)
[    0.079179] Spectre V1 : Mitigation: usercopy/swapgs barriers and __user pointer sanitization
[    0.081955] Freeing SMP alternatives memory: 40K
[    0.186424] smpboot: CPU0: AMD Ryzen 7 5800U with Radeon Graphics (family: 0x19, model: 0x50, stepping: 0x0)
[    0.187845] smp: Bringing up secondary CPUs ...
[    0.212076] smp: Brought up 1 node, 16 CPUs
[    0.215199] devtmpfs: initialized
[    0.216495] cpuidle: using governor menu
[    0.246859] pci 0000:00:00.0: [1022:1630] type 00 class 0x060000
[    0.256237] SCSI subsystem initialized
[    0.256237] libata version 3.00 loaded.
[    0.271223] Trying to unpack rootfs image as initramfs...
:: Running early hook [udev]
[    0.272458] Initialise system trusted keyrings
[    0.280025] Block layer SCSI generic (bsg) driver version 0.4 loaded (major 242)
[    0.291907] Non-volatile memory driver v1.3
:: Running hook [udev]
:: Triggering uevents...
[    0.305313] ahci 0000:00:08.0: AHCI 0001.0301 32 slots 1 ports 6 Gbps 0x1 impl SATA mode
[    0.333358] NET: Registered PF_INET protocol family
[    0.617619] ata1: SATA link up 6.0 Gbps (SStatus 133 SControl 300)
[    0.644076]  sda: sda1 sda2 sda3
[    0.658343] nvme nvme0: pci function 0000:01:00.0
[    0.843285] random: crng init done
[    1.612929] EXT4-fs (nvme0n1p2): mounted filesystem 3c7e2a4f-9b1d-4e8a-a3c2-7f8e4d2b1a9c ro with ordered data mode. Quota mode: none.
[    1.724943] systemd[1]: Detected architecture x86-64.
[    1.863099] systemd[1]: Starting systemd-journald.service - Journal Service...
[    1.886273] systemd[1]: Started systemd-journald.service - Journal Service.
[    2.078912] EXT4-fs (nvme0n1p2): re-mounted 3c7e2a4f-9b1d-4e8a-a3c2-7f8e4d2b1a9c r/w. Quota mode: none.
[    2.385373] iwlwifi 0000:03:00.0: loaded firmware version 72.daa05125.0 QuZ-a0-hr-b0-72.ucode op_mode iwlmvm
[    2.701458] iwlwifi 0000:03:00.0: Detected Intel(R) Wi-Fi 6 AX200 160MHz, REV=0x340
[    3.156913] [drm] amdgpu kernel modesetting enabled.
[    3.385181] Console: switching to colour frame buffer device 240x67
[  OK  ] Started udev Kernel Device Manager.
         Starting Coldplug All udev Devices...
[  OK  ] Finished Coldplug All udev Devices.
         Starting Load Kernel Modules...
[  OK  ] Finished Load Kernel Modules.
         Starting Apply Kernel Variables...
[  OK  ] Finished Apply Kernel Variables.
         Starting Device Node Population...
[  OK  ] Finished Device Node Population.
         Starting Apply Kernel Configuration...
[  OK  ] Finished Apply Kernel Configuration.
         Starting File System Check on /dev/nvme0n1p2...
[  OK  ] Finished File System Check on /dev/nvme0n1p2.
         Starting Create Volatile Files and Directories...
[  OK  ] Finished Create Volatile Files and Directories.
         Starting Network Time Synchronization...
[  OK  ] Started Network Time Synchronization.
[  OK  ] Reached target System Time Set.
         Starting Update UTMP about System Boot/Shutdown...
[  OK  ] Finished Update UTMP about System Boot/Shutdown.
         Mounting /boot...
[  OK  ] Mounted /boot.
[  OK  ] Reached target Local File Systems.
         Starting Flush Journal to Persistent Storage...
[  OK  ] Finished Flush Journal to Persistent Storage.
         Starting Load/Save OS Random Seed...
[  OK  ] Finished Load/Save OS Random Seed.
         Starting Journal Service...
[  OK  ] Started Journal Service.
[  OK  ] Created slice User and Session Slice.
[  OK  ] Reached target Slice Units.
[  OK  ] Listening on D-Bus System Message Bus Socket.
         Starting Network Manager...
[  OK  ] Started Network Manager.
         Starting Hostname Service...
[  OK  ] Started Hostname Service.
         Starting Bluetooth service...
[  OK  ] Started Bluetooth service.
         Starting Login Service...
[  OK  ] Started Login Service.
[  OK  ] Reached target Multi-User System.
[  OK  ] Reached target Graphical Interface.

Arch Linux 6.9.0-arch1-1 (tty1)

archlinux login: _`;

const TERM = {
  bg: "#000000",
  fg: "#c0c0c0",
  bright: "#ffffff",
  ok: "#55ff55",
  warn: "#ffff55",
  fail: "#ff5555",
};

function LineText({ line }: { line: string }) {
  const isOk = line.startsWith("[  OK  ]");
  const isWarn = line.startsWith("[ WARN ]");
  const isFail = line.startsWith("[FAILED]");

  if (isOk || isWarn || isFail) {
    const status = isOk ? "[  OK  ]" : isWarn ? "[ WARN ]" : "[FAILED]";
    const rest = line.slice(status.length);
    return (
      <Text style={styles.line}>
        <Text
          style={[
            styles.statusPill,
            { color: isOk ? TERM.ok : isWarn ? TERM.warn : TERM.fail },
          ]}
        >
          {status}
        </Text>
        <Text style={styles.line}>{rest}</Text>
      </Text>
    );
  }

  if (line.startsWith("::")) {
    return <Text style={[styles.line, { color: TERM.bright }]}>{line}</Text>;
  }

  return <Text style={styles.line}>{line}</Text>;
}

export function BootScreen({ onDone }: BootScreenProps) {
  const [phase] = useState<Phase>("boot");
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [showPromptCursor, setShowPromptCursor] = useState(true);
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const lines = useMemo(
    () =>
      RAW_BOOT_LOG.split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0 || line === ""),
    [],
  );
  const finishRef = useRef(false);

  const finishBoot = React.useCallback(() => {
    if (finishRef.current) {
      return;
    }
    finishRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (phase !== "boot") {
      return;
    }

    const cursorTimer = setInterval(() => {
      setShowPromptCursor((value) => !value);
    }, 140);

    return () => clearInterval(cursorTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "boot") {
      return;
    }

    let cancelled = false;
    let index = 0;

    const pushChunk = () => {
      if (cancelled) {
        return;
      }

      const randomBurst = 2 + Math.floor(Math.random() * 6);
      const dynamicBurst = Math.min(randomBurst, lines.length - index);
      if (dynamicBurst <= 0) {
        setTimeout(() => {
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              finishBoot();
            }
          });
        }, 110);
        return;
      }

      const next = lines.slice(index, index + dynamicBurst);
      index += dynamicBurst;
      setVisibleLines((prev) => prev.concat(next));

      const stutter = Math.random() > 0.86;
      const delay = stutter
        ? 60 + Math.floor(Math.random() * 95)
        : 14 + Math.floor(Math.random() * 24);
      setTimeout(pushChunk, delay);
    };

    setTimeout(pushChunk, 45);

    return () => {
      cancelled = true;
    };
  }, [containerOpacity, finishBoot, lines, phase]);

  useEffect(() => {
    const hardTimeout = setTimeout(() => {
      if (finishRef.current) {
        return;
      }

      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        finishBoot();
      });
    }, 5000);

    return () => clearTimeout(hardTimeout);
  }, [containerOpacity, finishBoot]);

  useEffect(() => {
    if (phase !== "boot") {
      return;
    }
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [phase, visibleLines]);

  return (
    <Animated.View style={[styles.overlay, { opacity: containerOpacity }]}>
      <View style={styles.stage}>
        {phase === "boot" ? (
          <ScrollView
            ref={(ref) => {
              scrollRef.current = ref;
            }}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {visibleLines.map((line, index) => (
              <LineText key={`${line}-${index}`} line={line} />
            ))}
            <Text style={styles.line}>{showPromptCursor ? "_" : " "}</Text>
          </ScrollView>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TERM.bg,
    zIndex: 50,
  },
  stage: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  line: {
    color: TERM.fg,
    fontFamily: "SpaceMono",
    fontSize: 12,
    lineHeight: 16,
  },
  prompt: {
    color: TERM.bright,
  },
  statusPill: {
    backgroundColor: "#101010",
  },
});
