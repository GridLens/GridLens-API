const mockDb = {
  zones: [
    { zone: "Zone 1", healthyPct: 94.2 },
    { zone: "Zone 2", healthyPct: 93.1 },
    { zone: "Zone 3", healthyPct: 92.0 },
    { zone: "Zone 4", healthyPct: 95.0 }
  ],

  meters: {
    total: 12000,
    healthy: 11250,
    problem: 750,
    systemHealthPct: 93.8
  },

  sampleProblemMeters: [
    { meterId: "E-551032", address: "456 Pine St", zone: "Zone 2", status: "UNREACHABLE" },
    { meterId: "E-445021", address: "123 Oak St", zone: "Zone 1", status: "UNREACHABLE" },
    { meterId: "E-662148", address: "789 Elm Ave", zone: "Zone 3", status: "LOW_VOLTAGE" },
    { meterId: "E-773259", address: "321 Main St", zone: "Zone 3", status: "TAMPER_ALERT" },
    { meterId: "E-884370", address: "555 Cedar Blvd", zone: "Zone 2", status: "COMM_FAILURE" }
  ],

  feeders: [
    { feeder: "Feeder 101", zone: "Zone 1", lossPct: 4.2, lossKWh: 12500, lossDollars: 18750, activeWorkOrders: 2 },
    { feeder: "Feeder 202", zone: "Zone 2", lossPct: 3.1, lossKWh: 9800, lossDollars: 14700, activeWorkOrders: 1 },
    { feeder: "Feeder 303", zone: "Zone 3", lossPct: 2.6, lossKWh: 7600, lossDollars: 11400, activeWorkOrders: 0 },
    { feeder: "Feeder 404", zone: "Zone 3", lossPct: 5.0, lossKWh: 15000, lossDollars: 22500, activeWorkOrders: 3 },
    { feeder: "Feeder 505", zone: "Zone 4", lossPct: 1.8, lossKWh: 4200, lossDollars: 6300, activeWorkOrders: 0 }
  ],

  suspiciousMeters: [
    { meterId: "E-773259", address: "321 Main St", zone: "Zone 3", riskScore: 0.95, issueType: "suspected_theft" },
    { meterId: "E-551032", address: "456 Pine St", zone: "Zone 2", riskScore: 0.87, issueType: "suspected_bypass" },
    { meterId: "E-445021", address: "123 Oak St", zone: "Zone 1", riskScore: 0.91, issueType: "reverse_flow" },
    { meterId: "E-662148", address: "789 Elm Ave", zone: "Zone 3", riskScore: 0.72, issueType: "constant_low_usage" },
    { meterId: "E-884370", address: "555 Cedar Blvd", zone: "Zone 2", riskScore: 0.68, issueType: "erratic_usage" }
  ],

  fieldWorkOrders: [
    { id: "WO-1001", meterId: "E-551032", type: "suspected_theft", location: "456 Pine St", zone: "Zone 2", status: "In Progress", priority: "High", ageDays: 4, assignedTo: "Tech Team A", estimatedRecoveredDollars: 320, source: "electric_usage_loss", feeder: "Feeder 202", issueCode: "CONTINUOUS_USAGE_7D", summary: "Continuous high usage for 7+ days – possible theft or wiring issue.", createdAt: "2025-12-04T09:00:00Z" },
    { id: "WO-1002", meterId: "E-445021", type: "stopped_meter", location: "123 Oak St", zone: "Zone 1", status: "Open", priority: "High", ageDays: 8, assignedTo: "Unassigned", estimatedRecoveredDollars: 190, source: "meter_health", feeder: "Feeder 101", issueCode: "METER_STOPPED", summary: "Meter stopped registering consumption.", createdAt: "2025-11-30T14:30:00Z" },
    { id: "WO-1003", meterId: "E-662148", type: "reverse_flow", location: "789 Elm Ave", zone: "Zone 3", status: "Scheduled", priority: "Medium", ageDays: 2, assignedTo: "Tech Team B", estimatedRecoveredDollars: 85, source: "energy_loss", feeder: "Feeder 303", issueCode: "REVERSE_FLOW", summary: "Reverse flow detected indicating potential solar without agreement.", createdAt: "2025-12-06T11:15:00Z" },
    { id: "WO-1004", meterId: "E-773259", type: "suspected_bypass", location: "321 Main St", zone: "Zone 3", status: "Open", priority: "Critical", ageDays: 5, assignedTo: "Unassigned", estimatedRecoveredDollars: 425, source: "theft_detection", feeder: "Feeder 404", issueCode: "TAMPER_DETECTED", summary: "Tamper seal broken, possible meter bypass.", createdAt: "2025-12-03T08:45:00Z" },
    { id: "WO-1005", meterId: "E-884370", type: "meter_inspection", location: "555 Cedar Blvd", zone: "Zone 2", status: "In Progress", priority: "Medium", ageDays: 14, assignedTo: "Tech Team A", estimatedRecoveredDollars: 156, source: "routine_inspection", feeder: "Feeder 202", issueCode: "SCHEDULED_INSPECTION", summary: "Routine meter inspection due.", createdAt: "2025-11-24T10:00:00Z" }
  ],

  waterLeakCandidates: [
    { meterId: "20054321", address: "45 Oak St", zone: "Zone 3", daysFlow: 9, riskScore: 0.91, estLossDollars: 520.75, status: "Investigating" },
    { meterId: "20098765", address: "99 Pine Ave", zone: "Zone 2", daysFlow: 6, riskScore: 0.84, estLossDollars: 3210.10, status: "New" },
    { meterId: "20076543", address: "123 Maple Dr", zone: "Zone 1", daysFlow: 12, riskScore: 0.78, estLossDollars: 890.50, status: "Confirmed" },
    { meterId: "20087654", address: "456 Birch Ln", zone: "Zone 4", daysFlow: 4, riskScore: 0.65, estLossDollars: 245.00, status: "New" }
  ],

  electricUsage: {
    totalUsageKWh: 1250000,
    estimatedLossKWh: 12500,
    avgDailyKWh: 25000,
    systemLossPct: 1.0,
    activeWorkOrders: 6
  },

  electricTrend: [
    { date: "2025-12-01", kWh: 24500 },
    { date: "2025-12-02", kWh: 25200 },
    { date: "2025-12-03", kWh: 24900 },
    { date: "2025-12-04", kWh: 26100 },
    { date: "2025-12-05", kWh: 25800 },
    { date: "2025-12-06", kWh: 24700 },
    { date: "2025-12-07", kWh: 23900 }
  ],

  electricZones: [
    { zone: "Zone 1", kWh: 320000 },
    { zone: "Zone 2", kWh: 280000 },
    { zone: "Zone 3", kWh: 220000 },
    { zone: "Zone 4", kWh: 210000 }
  ],

  topLossPoints: [
    { meterId: "E1001", address: "101 Grid Ave", zone: "Zone 1", lossKWh: 1200, lossDollars: 1875 },
    { meterId: "E1002", address: "202 Power St", zone: "Zone 2", lossKWh: 980, lossDollars: 1470 },
    { meterId: "E1003", address: "303 Volt Blvd", zone: "Zone 3", lossKWh: 850, lossDollars: 1275 }
  ],

  outagesOverview: {
    activeOutages: 5,
    customersOut: 382,
    feedersImpacted: 3,
    worstCurrentDurationHours: 6.4,
    avgRestorationMinutes30d: 72,
    sustainedInterruptions24h: 41,
    momentaryEvents30d: 136,
    criticalCustomersTracked: 3
  },

  activeOutages: [
    { outageId: "OUT-1023", feeder: "FDR-3 North Loop", cause: "Tree on line", customersOut: 145, startedAt: "2025-12-06T07:42:00Z", etaRestore: "2025-12-06T10:30:00Z", priority: "High", status: "Crew onsite" },
    { outageId: "OUT-1024", feeder: "FDR-5 Industrial", cause: "Equipment failure", customersOut: 89, startedAt: "2025-12-06T08:15:00Z", etaRestore: "2025-12-06T11:00:00Z", priority: "High", status: "Assessing" },
    { outageId: "OUT-1025", feeder: "FDR-2 Downtown", cause: "Vehicle accident", customersOut: 67, startedAt: "2025-12-06T09:30:00Z", etaRestore: "2025-12-06T12:00:00Z", priority: "Medium", status: "Dispatched" },
    { outageId: "OUT-1026", feeder: "FDR-7 Residential", cause: "Planned maintenance", customersOut: 45, startedAt: "2025-12-06T06:00:00Z", etaRestore: "2025-12-06T14:00:00Z", priority: "Low", status: "In Progress" },
    { outageId: "OUT-1027", feeder: "FDR-1 Commercial", cause: "Unknown", customersOut: 36, startedAt: "2025-12-06T10:00:00Z", etaRestore: "2025-12-06T13:00:00Z", priority: "Medium", status: "Investigating" }
  ],

  reliability30d: [
    { feeder: "FDR-3", customers: 2100, outages: 7, customersInterrupted: 480, saidiMinutes: 82, saifi: 1.2, worstOutageMinutes: 190, priority: "High" },
    { feeder: "FDR-5", customers: 1800, outages: 4, customersInterrupted: 320, saidiMinutes: 54, saifi: 0.9, worstOutageMinutes: 120, priority: "Medium" },
    { feeder: "FDR-2", customers: 2500, outages: 3, customersInterrupted: 210, saidiMinutes: 38, saifi: 0.6, worstOutageMinutes: 95, priority: "Low" },
    { feeder: "FDR-7", customers: 3200, outages: 2, customersInterrupted: 150, saidiMinutes: 22, saifi: 0.4, worstOutageMinutes: 60, priority: "Low" },
    { feeder: "FDR-1", customers: 1500, outages: 5, customersInterrupted: 380, saidiMinutes: 68, saifi: 1.1, worstOutageMinutes: 145, priority: "Medium" }
  ],

  amiEvents: [
    { time: "09:02", eventType: "Outage started", severity: "High", feeder: "FDR-3", metersAffected: 74, note: "Last-gasp from industrial segment; voltage loss detected." },
    { time: "09:05", eventType: "Voltage sag", severity: "Medium", feeder: "FDR-5", metersAffected: 23, note: "Voltage drop detected across commercial meters." },
    { time: "09:12", eventType: "Restoration", severity: "Info", feeder: "FDR-2", metersAffected: 45, note: "Power restored to residential segment." },
    { time: "09:18", eventType: "Comm failure", severity: "Low", feeder: "FDR-7", metersAffected: 12, note: "Communication timeout with meter cluster." },
    { time: "09:25", eventType: "Tamper alert", severity: "High", feeder: "FDR-1", metersAffected: 1, note: "Possible meter tampering detected at commercial site." }
  ],

  criticalCustomers: [
    { customerName: "Regional Medical Center", meterId: "E-501122", feeder: "FDR-3", status: "On generator", lastEvent: "Sag / outage 45m ago", priority: "Critical" },
    { customerName: "City Water Treatment", meterId: "E-501234", feeder: "FDR-5", status: "Normal", lastEvent: "Momentary 2h ago", priority: "Critical" },
    { customerName: "Downtown Fire Station", meterId: "E-501345", feeder: "FDR-2", status: "Normal", lastEvent: "None in 7 days", priority: "High" }
  ]
};

export default mockDb;
