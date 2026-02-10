import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";

const GRUB_LINES = [
  "GNU GRUB 2.12",
  "",
  "I Use Arch Linux (linux)",
  "Advanced options for Arch Linux",
  "Memory test (memtest86+)",
  "Memory test (memtest86+ serial console)",
  "",
  "Use the up and down keys to select which entry is highlighted.",
  "Press Enter to boot the selected OS, 'e' to edit commands,",
  "or 'c' for a command-line.",
];

// Much faster with extreme randomness
const BOOT_TOTAL_SECONDS = 0.5;
const GRUB_LINE_DURATION = 3;
const GRUB_BOOT_GAP = 8;
const POST_BOOT_DELAY = 2;
const FADE_DURATION = 6;
const SCROLL_DURATION = 1;

const BOOT_LINES = [
  "Loading Linux /vmlinuz-linux ...",
  "Loading initial ramdisk /initramfs-linux.img ...",
  ":: Running early hook [udev]",
  ":: Running hook [udev]",
  ":: Triggering uevents...",
  "[KERNEL] EFI: Loaded cert 'Microsoft Windows Production PCA 2011'",
  "[KERNEL] platform eisa.0: Probing EISA bus 0",
  "[KERNEL] ACPI: EC: EC started",
  "[KERNEL] zswap: loaded using pool lzo/zbud",
  "[KERNEL] x86: Booting SMP configuration:",
  "[KERNEL] smpboot: CPU0: {cpu}",
  "[KERNEL] ACPI: PM: Power Button [PWRF]",
  "[KERNEL] pci 0000:00:00.2: AMD-Vi: IOMMU performance counters supported",
  "[KERNEL] EXT4-fs ({disk}): recovery complete",
  "[  OK  ] Started udev Kernel Device Manager.",
  "         Starting Coldplug All udev Devices...",
  "[  OK  ] Finished Coldplug All udev Devices.",
  "         Starting Load Kernel Modules...",
  "[  OK  ] Finished Load Kernel Modules.",
  "         Starting Apply Kernel Variables...",
  "[  OK  ] Finished Apply Kernel Variables.",
  "         Starting Device Node Population...",
  "[  OK  ] Finished Device Node Population.",
  "         Starting Apply Kernel Configuration...",
  "[  OK  ] Finished Apply Kernel Configuration.",
  "         Starting File System Check on /dev/{disk}...",
  "[  OK  ] Finished File System Check on /dev/{disk}.",
  "         Starting Create Volatile Files and Directories...",
  "[  OK  ] Finished Create Volatile Files and Directories.",
  "         Starting Swap File Setup...",
  "[  OK  ] Finished Swap File Setup.",
  "         Starting Kernel Cache Check...",
  "[  OK  ] Finished Kernel Cache Check.",
  "         Starting Kernel Self-Tests...",
  "[  OK  ] Finished Kernel Self-Tests.",
  "         Mounting /boot...",
  "[  OK  ] Mounted /boot.",
  "[  OK  ] Mounted /.",
  "         Starting Flush Journal to Persistent Storage...",
  "[  OK  ] Finished Flush Journal to Persistent Storage.",
  "         Starting Journal Service...",
  "[  OK  ] Started Journal Service.",
  "         Starting Load/Save OS Random Seed...",
  "[  OK  ] Finished Load/Save OS Random Seed.",
  "         Starting System Logging Buffer Flush...",
  "[  OK  ] Finished System Logging Buffer Flush.",
  "         Starting User Slice...",
  "[  OK  ] Created slice User Slice.",
  "         Starting User Manager for UID {uid}...",
  "[  OK  ] Started User Manager for UID {uid}.",
  "         Starting Network Manager...",
  "[  OK  ] Started Network Manager.",
  "         Starting Hostname Service...",
  "[  OK  ] Started Hostname Service.",
  "         Starting Bluetooth Service...",
  "[  OK  ] Started Bluetooth Service.",
  "         Starting Login Service...",
  "[  OK  ] Started Login Service.",
  "         Starting Virtual Console Setup...",
  "[  OK  ] Finished Virtual Console Setup.",
  "         Starting Sound Card...",
  "[  OK  ] Started Sound Card.",
  "         Starting System Sound Service...",
  "[  OK  ] Started System Sound Service.",
  "         Starting Network Name Resolution...",
  "[  OK  ] Started Network Name Resolution.",
  "         Starting Time Synchronization...",
  "[  OK  ] Started Time Synchronization.",
  "[  OK  ] Reached target Graphical Interface.",
  "Arch Linux {kernel} (tty1)",
];

const CPU_MODELS = [
  "AMD Ryzen 7 5800U",
  "AMD Ryzen 5 5600X",
  "Intel(R) Core(TM) i7-8650U",
  "Intel(R) Core(TM) i5-8250U",
  "Intel(R) Core(TM) i9-10900K",
];

const KERNEL_VERSIONS = ["6.9.0-arch1-1", "6.8.9-arch1-1", "6.7.6-arch1-1"];

const DISK_DEVICES = ["nvme0n1p2", "nvme1n1p2", "sda2", "sdb2"];

const KERNEL_EXTRA = [
  "[KERNEL] tsc: Refined TSC clocksource calibration: {tsc} MHz",
  "[KERNEL] random: crng init done",
  "[KERNEL] i8042: PNP: PS/2 Controller [PNP0303:KBC,PNP0f13:PS2M]",
  "[KERNEL] usbcore: registered new interface driver usbhid",
  "[KERNEL] usbcore: registered new device driver usb",
  "[KERNEL] usb 1-2: new full-speed USB device number 3 using xhci_hcd",
  "[KERNEL] xhci_hcd 0000:00:14.0: xHCI Host Controller",
  "[KERNEL] xhci_hcd 0000:00:14.0: new USB bus registered",
  "[KERNEL] usb 1-1: new high-speed USB device number 2 using xhci_hcd",
  "[KERNEL] usb 1-1: New USB device found, idVendor=8087, idProduct=0aaa",
  "[KERNEL] input: AT Translated Set 2 keyboard as /devices/platform/i8042/serio0/input/input0",
  "[KERNEL] hid-generic 0003:046D:C52B: input,hidraw0: USB HID v1.11 Keyboard",
  "[KERNEL] ahci 0000:00:17.0: AHCI 0001.0301 32 slots 6 ports 6 Gbps",
  "[KERNEL] nvme nvme0: pci function 0000:01:00.0",
  "[KERNEL] nvme nvme0: 4/0/0 default/read/poll queues",
  "[KERNEL] EXT4-fs ({disk}): mounted filesystem with ordered data mode",
  "[KERNEL] snd_hda_intel 0000:00:1f.3: enabling device (0000 -> 0002)",
  "[KERNEL] snd_hda_codec_realtek hdaudioC0D0: autoconfig for ALC256",
  "[KERNEL] iwlwifi 0000:02:00.0: loaded firmware version 86.35.0",
  "[KERNEL] iwlwifi 0000:02:00.0: Detected Intel(R) Dual Band Wireless",
  "[KERNEL] Bluetooth: hci0: Firmware revision 0.1 build 35 week 3 2022",
  "[KERNEL] Bluetooth: hci0: Intel firmware patch completed and activated",
  "[KERNEL] audit: initializing netlink subsys (disabled)",
  "[KERNEL] RAPL PMU: API unit is 2^-32 Joules, 2 fixed counters, 4 power domains",
  "[KERNEL] Freeing unused kernel memory: 2048K",
  "[KERNEL] PCI: CLS 0 bytes, default 64",
];

const SYSTEMD_UNITS = [
  "D-Bus System Message Bus",
  "Firmware Update Service",
  "Device Mapper Monitoring",
  "System Logging Service",
  "Local Filesystems",
  "Kernel Module Loading",
  "Disk Manager",
  "System Time Synchronization",
  "Load/Save Random Seed",
  "Remount Root and Kernel File Systems",
  "User Login Management",
  "Network Time Synchronization",
  "Thermal Daemon Service",
  "Power Profiles Daemon",
  "System Accounts Service",
  "Network Name Resolution",
  "CUPS Scheduler",
  "Avahi mDNS/DNS-SD Stack",
  "User Runtime Directory /run/user/1000",
  "Modem Manager",
  "RealtimeKit Scheduling Policy Service",
  "Bluetooth service",
  "System Logging via syslog",
  "Network Manager Wait Online",
  "Network Manager Script Dispatcher",
  "LVM2 metadata daemon",
  "Authorization Manager",
  "Cache for core dumps",
  "CPU frequency scaling daemon",
  "User Database Manager",
  "SUID sandbox helper",
  "Socket Activation for PipeWire",
  "WirePlumber Multimedia Service",
  "PipeWire Multimedia Service",
  "Timesyncd",
  "Systemd Backlight Service",
  "Systemd RFKill Switch Status",
  "Systemd Update UTMP about System Boot/Shutdown",
  "Systemd Sysctl Service",
  "Systemd Random Seed",
  "Systemd Journal Catalog Update",
  "Systemd Load Kernel Module",
  "Systemd Update UTMP about System Runlevel Changes",
  "Systemd-boot Random Seed",
  "Systemd Networkd",
  "Systemd Resolve",
  "Systemd Hostnamed",
  "Systemd Localed",
  "Systemd Timedated",
];

type BootLine = {
  text: string;
  tone?: "ok" | "info" | "dim" | "warn" | "fail" | "plain";
};

type SpanTone = "ok" | "warn" | "fail" | "dim" | "plain";
type BootSpan = {
  text: string;
  tone: SpanTone;
};

const STATUS_TONE: Record<string, SpanTone> = {
  OK: "ok",
  WARN: "warn",
  FAILED: "fail",
};

const parseStatusSpans = (text: string): BootSpan[] => {
  const match = text.match(/^\[(\s*OK\s*|\s*WARN\s*|FAILED)\](\s*)(.*)$/);
  if (!match) {
    return [{ text, tone: "plain" }];
  }
  const status = match[1].trim();
  const gap = match[2] ?? " ";
  const rest = match[3] ?? "";
  return [
    { text: `[${status}]`, tone: STATUS_TONE[status] ?? "plain" },
    { text: gap, tone: "plain" },
    { text: rest, tone: "plain" },
  ];
};

const pick = <T,>(values: T[]) =>
  values[Math.floor(Math.random() * values.length)];

const shuffle = <T,>(values: T[]) => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createTimestamp = () => {
  let current = 0.18 + Math.random() * 0.08;
  return () => {
    current += 0.02 + Math.random() * 0.18;
    return `[    ${current.toFixed(6)}]`;
  };
};

const applyReplacements = (
  line: string,
  replacements: Record<string, string>,
) => {
  let updated = line;
  Object.entries(replacements).forEach(([key, value]) => {
    updated = updated.replaceAll(key, value);
  });
  return updated;
};

const buildBootLines = () => {
  const disk = pick(DISK_DEVICES);
  const kernel = pick(KERNEL_VERSIONS);
  const cpu = pick(CPU_MODELS);
  const uid = Math.random() > 0.5 ? "1000" : "1001";
  const tsc = (3300 + Math.floor(Math.random() * 700)).toString();
  const replacements = {
    "{disk}": disk,
    "{kernel}": kernel,
    "{cpu}": cpu,
    "{uid}": uid,
    "{tsc}": tsc,
  };
  const timestamp = createTimestamp();

  // Reduced for speed
  const kernelExtras = shuffle(KERNEL_EXTRA).slice(
    0,
    2 + Math.floor(Math.random() * 3),
  );
  // Reduced for speed
  const systemdUnits = shuffle(SYSTEMD_UNITS).slice(
    0,
    3 + Math.floor(Math.random() * 4),
  );

  const baseLines = BOOT_LINES.map((line) =>
    applyReplacements(line, replacements),
  );
  const kernelStart = baseLines.findIndex((line) =>
    line.startsWith("[KERNEL]"),
  );
  if (kernelStart >= 0) {
    baseLines.splice(
      kernelStart + 2,
      0,
      ...kernelExtras.map((line) => applyReplacements(line, replacements)),
    );
  }

  const journalIndex = baseLines.findIndex((line) =>
    line.includes("Started Journal Service."),
  );
  if (journalIndex >= 0) {
    const extraLines = systemdUnits.flatMap((unit) => [
      `         Starting ${unit}...`,
      `[  OK  ] Started ${unit}.`,
    ]);
    baseLines.splice(journalIndex + 1, 0, ...extraLines);
  }

  const allowRandomStatus = (text: string) =>
    !text.includes("Reached target") &&
    !text.includes("Mounted /") &&
    !text.includes("Journal Service");

  return baseLines.map((line): BootLine => {
    const isKernel = line.startsWith("[KERNEL]");
    const cleaned = isKernel ? line.replace("[KERNEL] ", "") : line;
    const timestamped = isKernel ? `${timestamp()} ${cleaned}` : cleaned;

    if (timestamped.startsWith("[  OK  ]") && allowRandomStatus(timestamped)) {
      const roll = Math.random();
      if (roll > 0.995) {
        return {
          text: timestamped.replace("[  OK  ]", "[FAILED]"),
          tone: "fail",
        };
      }
      if (roll > 0.96) {
        return {
          text: timestamped.replace("[  OK  ]", "[ WARN ]"),
          tone: "warn",
        };
      }
      return { text: timestamped, tone: "ok" };
    }
    if (timestamped.startsWith("::")) {
      return { text: timestamped, tone: "info" };
    }
    if (timestamped.startsWith("[")) {
      return { text: timestamped, tone: "dim" };
    }
    return { text: timestamped, tone: "plain" };
  });
};

type BootScreenProps = {
  onDone: () => void;
};

function BootLineText({ line }: { line: BootLine }) {
  const spans = useMemo(() => parseStatusSpans(line.text), [line.text]);
  return (
    <ThemedText
      style={[
        styles.line,
        line.tone === "ok" && styles.lineOk,
        line.tone === "info" && styles.lineInfo,
        line.tone === "dim" && styles.lineDim,
        line.tone === "warn" && styles.lineWarn,
        line.tone === "fail" && styles.lineFail,
      ]}
    >
      {spans.map((span, index) => (
        <ThemedText
          key={`${span.text}-${index}`}
          style={[
            styles.line,
            span.tone === "ok" && styles.statusOk,
            span.tone === "warn" && styles.statusWarn,
            span.tone === "fail" && styles.statusFail,
            span.tone === "dim" && styles.lineDim,
          ]}
        >
          {span.text}
        </ThemedText>
      ))}
    </ThemedText>
  );
}

export function BootScreen({ onDone }: BootScreenProps) {
  const grubOpacities = useRef(
    GRUB_LINES.map(() => new Animated.Value(0)),
  ).current;
  const bootLines = useMemo(() => buildBootLines(), []);
  const bootDurations = useMemo(
    () =>
      bootLines.map((line) => {
        const text = line.text;
        // Random variation everywhere
        const randomFactor = Math.random();

        // Critical boot operations - random between fast and slow
        if (
          text.includes("Loading Linux") ||
          text.includes("Loading initial ramdisk")
        ) {
          return randomFactor > 0.5 ? 3 + Math.floor(Math.random() * 3) : 1;
        }
        // Filesystem - sometimes slow, usually fast
        if (text.includes("File System Check") || text.includes("Mounted")) {
          return randomFactor > 0.7 ? 2 + Math.floor(Math.random() * 2) : 1;
        }
        // Services - mostly instant, sometimes visible
        if (text.includes("Started") || text.includes("Starting")) {
          return randomFactor > 0.8 ? 2 : 1;
        }
        // Kernel - instant or very fast
        if (text.startsWith("[")) {
          return randomFactor > 0.9 ? 2 : 1;
        }
        // Default with randomness
        return randomFactor > 0.7 ? 2 : 1;
      }),
    [bootLines],
  );
  const grubDelays = useMemo(
    () =>
      GRUB_LINES.map(() => {
        // Completely random delays
        return Math.floor(Math.random() * 5);
      }),
    [],
  );
  const bootDelays = useMemo(
    () =>
      bootLines.map((line) => {
        const text = line.text;
        const rand = Math.random();

        // Critical ops sometimes get delay, sometimes don't
        if (
          text.includes("Loading Linux") ||
          text.includes("Loading initial ramdisk")
        ) {
          return rand > 0.6 ? Math.floor(Math.random() * 4) : 0;
        }
        // Hardware detection - random
        if (
          text.includes("Triggering uevents") ||
          text.includes("Running hook")
        ) {
          return rand > 0.7 ? Math.floor(Math.random() * 3) : 0;
        }
        // Everything else - mostly zero, sometimes random delay
        if (rand > 0.9) {
          return Math.floor(Math.random() * 3);
        }
        return 0;
      }),
    [bootLines],
  );
  const bootOpacities = useRef(
    bootLines.map(() => new Animated.Value(0)),
  ).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const scrollOffset = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const visibleLines = 22;
  const lineStep = 16;

  const bootPlan = useMemo(() => {
    const plan: { jitter: number; pauseAfter: number }[] = [];
    let burstMode = false;
    let burstCount = 0;
    let lastPauseIndex = -10;

    bootLines.forEach((line, index) => {
      const text = line.text;
      let jitter = 0;
      let pauseAfter = 0;

      // Random chance of entering burst mode anywhere
      if (Math.random() > 0.85 && !burstMode && index > 10) {
        burstMode = true;
        burstCount = 0;
      }

      // Random chance of exiting burst mode
      if (burstMode && Math.random() > 0.7 && burstCount > 5) {
        burstMode = false;
        pauseAfter = 8 + Math.floor(Math.random() * 20); // Random pause after burst
      }

      // EXTREME RANDOM HOLDS - can happen anywhere!
      const timeSinceLastPause = index - lastPauseIndex;
      const shouldRandomPause = Math.random() > 0.92 && timeSinceLastPause > 5;

      if (shouldRandomPause) {
        pauseAfter = Math.floor(Math.random() * 40); // 0-40ms random pause
        lastPauseIndex = index;
      }

      // BIG DRAMATIC PAUSES on critical ops (but with randomness)
      if (text.includes("Loading Linux") && text.includes("vmlinuz")) {
        pauseAfter = Math.max(pauseAfter, 20 + Math.floor(Math.random() * 25));
        lastPauseIndex = index;
      } else if (text.includes("Loading initial ramdisk")) {
        pauseAfter = Math.max(pauseAfter, 15 + Math.floor(Math.random() * 20));
        lastPauseIndex = index;
      }
      // Sometimes pause on udev, sometimes burst through
      else if (text.includes("Triggering uevents")) {
        if (Math.random() > 0.4) {
          pauseAfter = Math.max(
            pauseAfter,
            10 + Math.floor(Math.random() * 15),
          );
          lastPauseIndex = index;
        }
        burstMode = Math.random() > 0.3; // Maybe start burst
        burstCount = 0;
      }
      // Random pauses on filesystem ops
      else if (text.includes("File System Check") && Math.random() > 0.3) {
        pauseAfter = Math.max(pauseAfter, 8 + Math.floor(Math.random() * 18));
        lastPauseIndex = index;
      }
      // Maybe pause on journal flush
      else if (text.includes("Flush Journal") && Math.random() > 0.5) {
        pauseAfter = Math.max(pauseAfter, 10 + Math.floor(Math.random() * 12));
        lastPauseIndex = index;
      }
      // Random network pause
      else if (text.includes("Network Manager") && Math.random() > 0.6) {
        pauseAfter = Math.max(pauseAfter, 6 + Math.floor(Math.random() * 10));
        lastPauseIndex = index;
      }

      // BURST MODE: Zero everything
      if (burstMode) {
        jitter = 0;
        if (!shouldRandomPause && pauseAfter < 5) {
          pauseAfter = 0;
        }
        burstCount++;

        // Occasional stutter in burst
        if (Math.random() > 0.95) {
          pauseAfter = 2 + Math.floor(Math.random() * 4);
        }
      }
      // NORMAL MODE: Random jitter
      else {
        // Random micro-jitter
        if (Math.random() > 0.5) {
          jitter = Math.floor(Math.random() * 3);
        }

        // Services sometimes get random delays
        if (text.includes("Starting") && Math.random() > 0.8) {
          pauseAfter = Math.max(pauseAfter, Math.floor(Math.random() * 8));
        }

        // OK messages sometimes stutter
        if (text.includes("[  OK  ]") && Math.random() > 0.85) {
          pauseAfter = Math.max(pauseAfter, Math.floor(Math.random() * 6));
        }
      }

      // Kernel messages always fast (unless random pause triggered)
      if (text.startsWith("[") && !shouldRandomPause) {
        jitter = 0;
        if (pauseAfter < 3) pauseAfter = 0;
      }

      plan.push({ jitter, pauseAfter });
    });

    return plan;
  }, [bootLines]);

  const estimatedDurationMs = useMemo(() => {
    const grubDuration = grubDelays.reduce(
      (sum, delay) => sum + delay + GRUB_LINE_DURATION,
      0,
    );
    let bootDuration = 0;
    bootLines.forEach((_, index) => {
      const delay = bootDelays[index] ?? 0;
      const duration = bootDurations[index] ?? 0;
      const scroll = index >= visibleLines ? SCROLL_DURATION : 0;
      const plan = bootPlan[index];
      bootDuration += delay + duration + scroll;
      bootDuration += plan ? plan.jitter + plan.pauseAfter : 0;
    });

    return (
      grubDuration +
      GRUB_BOOT_GAP +
      bootDuration +
      POST_BOOT_DELAY +
      FADE_DURATION
    );
  }, [
    bootDelays,
    bootDurations,
    bootLines,
    bootPlan,
    grubDelays,
    visibleLines,
  ]);

  const timeScale = useMemo(() => {
    const targetMs = BOOT_TOTAL_SECONDS * 1000;
    if (estimatedDurationMs <= 0) {
      return 1;
    }
    return Math.max(0.01, targetMs / estimatedDurationMs);
  }, [estimatedDurationMs]);

  const scaleDuration = (value: number) =>
    Math.max(1, Math.round(value * timeScale));

  const grubAnimations = useMemo(
    () =>
      grubOpacities.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: scaleDuration(GRUB_LINE_DURATION),
          useNativeDriver: true,
        }),
      ),
    [grubOpacities, scaleDuration],
  );

  const bootAnimations = useMemo(
    () =>
      bootOpacities.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: scaleDuration(bootDurations[index] ?? 1),
          useNativeDriver: true,
        }),
      ),
    [bootDurations, bootOpacities, scaleDuration],
  );

  useEffect(() => {
    const cursorLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0.25,
          duration: scaleDuration(100),
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: scaleDuration(100),
          useNativeDriver: true,
        }),
      ]),
    );
    cursorLoop.start();
    return () => cursorLoop.stop();
  }, [cursorOpacity, scaleDuration]);

  useEffect(() => {
    const grubSteps = grubAnimations.map((animation, index) =>
      Animated.sequence([
        Animated.delay(scaleDuration(grubDelays[index] ?? 3)),
        animation,
      ]),
    );

    const bootSteps = bootAnimations.map((animation, index) => {
      const shouldScroll = index >= visibleLines;
      return Animated.parallel([
        Animated.sequence([
          Animated.delay(scaleDuration(bootDelays[index] ?? 1)),
          animation,
        ]),
        ...(shouldScroll
          ? [
              Animated.timing(scrollOffset, {
                toValue: -(index - visibleLines + 1) * lineStep,
                duration: scaleDuration(SCROLL_DURATION),
                useNativeDriver: true,
              }),
            ]
          : []),
      ]);
    });

    const bootTimeline: Animated.CompositeAnimation[] = [];
    bootSteps.forEach((step, index) => {
      const plan = bootPlan[index];
      if (plan?.jitter) {
        bootTimeline.push(Animated.delay(scaleDuration(plan.jitter)));
      }
      bootTimeline.push(step);
      if (plan?.pauseAfter) {
        bootTimeline.push(Animated.delay(scaleDuration(plan.pauseAfter)));
      }
    });

    Animated.sequence([
      ...grubSteps,
      Animated.delay(scaleDuration(GRUB_BOOT_GAP)),
      ...bootTimeline,
      Animated.delay(scaleDuration(POST_BOOT_DELAY)),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: scaleDuration(FADE_DURATION),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDone();
      }
    });
  }, [
    bootAnimations,
    bootDelays,
    bootPlan,
    containerOpacity,
    grubAnimations,
    grubDelays,
    lineStep,
    onDone,
    scrollOffset,
    scaleDuration,
    visibleLines,
  ]);

  return (
    <Animated.View style={[styles.overlay, { opacity: containerOpacity }]}>
      <Animated.View
        style={[styles.tty, { transform: [{ translateY: scrollOffset }] }]}
      >
        <View style={styles.grubBlock}>
          {GRUB_LINES.map((line, index) => (
            <Animated.View
              key={`${line}-${index}`}
              style={{ opacity: grubOpacities[index] }}
            >
              <ThemedText
                style={[styles.grubLine, index === 2 && styles.grubSelected]}
              >
                {line || " "}
              </ThemedText>
            </Animated.View>
          ))}
        </View>
        {bootLines.map((line, index) => (
          <Animated.View
            key={`${line.text}-${index}`}
            style={{ opacity: bootOpacities[index] }}
          >
            <BootLineText line={line} />
          </Animated.View>
        ))}
        <View style={styles.promptRow}>
          <ThemedText style={styles.line}>archlinux login:</ThemedText>
          <Animated.View style={[styles.cursor, { opacity: cursorOpacity }]} />
        </View>
        <ThemedText style={styles.hintLine}>
          Press any key to enter boot options
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111111",
    alignItems: "stretch",
    justifyContent: "flex-start",
    zIndex: 50,
  },
  tty: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 80,
    minHeight: "112%",
    gap: 6,
  },
  grubBlock: {
    backgroundColor: "#0a2a66",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#888888",
    marginBottom: 8,
  },
  grubLine: {
    color: "#ffff00",
    fontSize: 12.5,
    fontFamily: "SpaceMono",
  },
  grubSelected: {
    color: "#0a2a66",
    backgroundColor: "#ffffff",
  },
  line: {
    color: "#979797",
    fontSize: 12.5,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  lineOk: {
    color: "#00ff00",
  },
  lineInfo: {
    color: "#0000ff",
  },
  lineDim: {
    color: "#ffffff",
  },
  lineWarn: {
    color: "#ffff00",
  },
  lineFail: {
    color: "#ff0000",
  },
  statusOk: {
    color: "#00ff00",
    backgroundColor: "#0a1a0f",
  },
  statusWarn: {
    color: "#ffff00",
    backgroundColor: "#1a1507",
  },
  statusFail: {
    color: "#ff0000",
    backgroundColor: "#22090c",
  },
  hintLine: {
    color: "#8a918d",
    fontSize: 11,
    fontFamily: "SpaceMono",
    marginTop: 12,
    opacity: 0.9,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  cursor: {
    width: 8,
    height: 12,
    backgroundColor: "#ffffff",
  },
});
