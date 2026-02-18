/**
 * BuildingCodes.js - Built-in requirement templates for lighting controls
 * 
 * Each building code defines requirements that a BOM should satisfy.
 * Requirements are categorized by type and can be matched against device capabilities.
 */

const BUILDING_CODES = {
  FBC: {
    id: 'FBC',
    name: 'Florida Building Code',
    description: 'Florida Building Code - Energy Conservation (based on IECC with Florida amendments)',
    version: '8th Edition (2023)',
    requirements: [
      {
        id: 'fbc_occ_sensing',
        name: 'Occupancy Sensing',
        category: 'Energy',
        description: 'Occupancy sensors required in enclosed spaces (offices, conference rooms, restrooms, storage, etc.)',
        deviceCategories: ['occupancy_sensor', 'ceiling_sensor', 'wall_sensor', 'vacancy_sensor']
      },
      {
        id: 'fbc_daylight_harvest',
        name: 'Daylight Harvesting',
        category: 'Energy',
        description: 'Automatic daylight responsive controls required for sidelighted and toplighted zones',
        deviceCategories: ['photosensor', 'daylight_sensor', 'dimming_controller']
      },
      {
        id: 'fbc_auto_shutoff',
        name: 'Automatic Shut-Off',
        category: 'Energy',
        description: 'Automatic shut-off of interior lighting within 30 minutes of vacancy (occupancy sensor, timer, or scheduling)',
        deviceCategories: ['occupancy_sensor', 'time_clock', 'scheduler', 'relay_panel']
      },
      {
        id: 'fbc_manual_control',
        name: 'Manual On Control',
        category: 'Energy',
        description: 'Manual on control required at each space (wall switch, wallpod)',
        deviceCategories: ['wall_switch', 'wallpod', 'keypad']
      },
      {
        id: 'fbc_exterior_shutoff',
        name: 'Exterior Lighting Control',
        category: 'Energy',
        description: 'Exterior lighting must have automatic scheduling or photocell control',
        deviceCategories: ['photocell', 'time_clock', 'scheduler', 'relay_panel']
      }
    ]
  },

  TITLE_24: {
    id: 'TITLE_24',
    name: 'California Title 24',
    description: 'California Energy Code - Part 6 (most stringent US lighting controls code)',
    version: '2022',
    requirements: [
      {
        id: 't24_occ_sensing',
        name: 'Occupancy Sensing',
        category: 'Energy',
        description: 'Occupancy sensors required in most enclosed spaces with auto-off within 20 minutes',
        deviceCategories: ['occupancy_sensor', 'ceiling_sensor', 'wall_sensor', 'vacancy_sensor']
      },
      {
        id: 't24_daylight_harvest',
        name: 'Daylight Harvesting',
        category: 'Energy',
        description: 'Automatic daylighting controls required in primary and secondary sidelighted zones and under skylights',
        deviceCategories: ['photosensor', 'daylight_sensor', 'dimming_controller']
      },
      {
        id: 't24_demand_response',
        name: 'Demand Response',
        category: 'Energy',
        description: 'Lighting must be capable of automatic demand response signal reception (15% reduction)',
        deviceCategories: ['demand_response', 'bridge', 'network_controller', 'bms_integration']
      },
      {
        id: 't24_paf',
        name: 'Power Adjustment Factor (PAF)',
        category: 'Energy',
        description: 'Controls qualifying for PAF credits must include institutional tuning, demand response, and scheduling',
        deviceCategories: ['dimming_controller', 'bridge', 'network_controller', 'scheduler']
      },
      {
        id: 't24_multi_level',
        name: 'Multi-Level Lighting',
        category: 'Energy',
        description: 'At least one step between 30-70% and full off required in spaces > 100 sq ft',
        deviceCategories: ['dimming_controller', 'dimming_driver', 'multi_level_switch']
      },
      {
        id: 't24_auto_shutoff',
        name: 'Automatic Shut-Off',
        category: 'Energy',
        description: 'Automatic shut-off within 20 minutes of vacancy via occupancy sensor or scheduling',
        deviceCategories: ['occupancy_sensor', 'time_clock', 'scheduler', 'relay_panel']
      },
      {
        id: 't24_manual_on',
        name: 'Manual On / Partial Auto-On',
        category: 'Energy',
        description: 'Manual on required; partial auto-on (50%) allowed in some spaces',
        deviceCategories: ['wall_switch', 'wallpod', 'keypad']
      },
      {
        id: 't24_institutional_tuning',
        name: 'Institutional Tuning',
        category: 'Energy',
        description: 'Ability to reduce maximum light output to a tuned level (high-end trim)',
        deviceCategories: ['dimming_controller', 'bridge', 'network_controller']
      }
    ]
  },

  IECC: {
    id: 'IECC',
    name: 'International Energy Conservation Code',
    description: 'Baseline energy conservation code adopted by many US states',
    version: '2021',
    requirements: [
      {
        id: 'iecc_occ_sensing',
        name: 'Occupancy Sensing',
        category: 'Energy',
        description: 'Occupancy sensors required in listed space types (offices, break rooms, storage, restrooms)',
        deviceCategories: ['occupancy_sensor', 'ceiling_sensor', 'wall_sensor', 'vacancy_sensor']
      },
      {
        id: 'iecc_daylight',
        name: 'Daylight Responsive Controls',
        category: 'Energy',
        description: 'Daylight responsive controls in daylit zones adjacent to vertical fenestration and under skylights',
        deviceCategories: ['photosensor', 'daylight_sensor', 'dimming_controller']
      },
      {
        id: 'iecc_auto_shutoff',
        name: 'Automatic Shut-Off',
        category: 'Energy',
        description: 'Interior lighting auto shut-off via occupancy sensors, time scheduling, or signal from other control system',
        deviceCategories: ['occupancy_sensor', 'time_clock', 'scheduler', 'relay_panel']
      },
      {
        id: 'iecc_exterior',
        name: 'Exterior Lighting Controls',
        category: 'Energy',
        description: 'Exterior lighting controlled by photosensor or astronomical time switch',
        deviceCategories: ['photocell', 'time_clock', 'scheduler']
      }
    ]
  },

  ASHRAE_90_1: {
    id: 'ASHRAE_90_1',
    name: 'ASHRAE 90.1',
    description: 'Energy Standard for Buildings Except Low-Rise Residential',
    version: '2022',
    requirements: [
      {
        id: 'ash_occ_control',
        name: 'Occupancy-Based Control',
        category: 'Energy',
        description: 'Occupancy sensors in enclosed spaces per Table 9.6.1',
        deviceCategories: ['occupancy_sensor', 'ceiling_sensor', 'wall_sensor', 'vacancy_sensor']
      },
      {
        id: 'ash_daylight',
        name: 'Daylight Responsive Controls',
        category: 'Energy',
        description: 'Automatic daylight responsive controls in daylit sidelit and toplit zones',
        deviceCategories: ['photosensor', 'daylight_sensor', 'dimming_controller']
      },
      {
        id: 'ash_auto_shutoff',
        name: 'Automatic Lighting Shutoff',
        category: 'Energy',
        description: 'All interior lighting on automatic shutoff (occupancy, scheduling, or signal-based)',
        deviceCategories: ['occupancy_sensor', 'time_clock', 'scheduler', 'relay_panel']
      },
      {
        id: 'ash_functional_testing',
        name: 'Functional Testing',
        category: 'Commissioning',
        description: 'Lighting controls must be functionally tested and documented',
        deviceCategories: ['bridge', 'network_controller']
      },
      {
        id: 'ash_exterior',
        name: 'Exterior Lighting Controls',
        category: 'Energy',
        description: 'Exterior lighting controlled by photosensor or astronomical time clock',
        deviceCategories: ['photocell', 'time_clock', 'scheduler']
      }
    ]
  },

  NEC: {
    id: 'NEC',
    name: 'National Electrical Code',
    description: 'NFPA 70 - Electrical safety code (emergency lighting and circuit requirements)',
    version: '2023',
    requirements: [
      {
        id: 'nec_emergency',
        name: 'Emergency Lighting',
        category: 'Life Safety',
        description: 'Emergency lighting circuits must be on separate branch circuits with automatic transfer',
        deviceCategories: ['emergency_relay', 'relay_panel', 'transfer_switch', 'emergency_controller']
      },
      {
        id: 'nec_egress',
        name: 'Egress Illumination',
        category: 'Life Safety',
        description: 'Means of egress must be illuminated at not less than 1 fc at floor level',
        deviceCategories: ['emergency_relay', 'emergency_controller', 'battery_backup']
      },
      {
        id: 'nec_circuit_separation',
        name: 'Emergency Circuit Separation',
        category: 'Life Safety',
        description: 'Emergency circuits must be kept independent from normal circuits at the relay/panel level',
        deviceCategories: ['relay_panel', 'emergency_relay', 'transfer_switch']
      }
    ]
  }
};

/**
 * Manual requirement presets - common project-specific requirements
 * that users can toggle on/off for their project
 */
const MANUAL_REQUIREMENTS = [
  {
    id: 'fire_alarm',
    name: 'Fire Alarm Integration',
    category: 'Life Safety',
    description: 'Fire alarm relay to override lighting controls during fire alarm event (all lights to full on)',
    deviceCategories: ['fire_alarm_relay', 'relay_panel', 'emergency_controller']
  },
  {
    id: 'hvac_integration',
    name: 'HVAC / BMS Integration',
    category: 'Integration',
    description: 'Integration with building management system for HVAC coordination and energy management',
    deviceCategories: ['bms_integration', 'bacnet_controller', 'bridge', 'network_controller']
  },
  {
    id: 'dmx_control',
    name: 'DMX Control',
    category: 'Integration',
    description: 'DMX-512 protocol support for architectural or theatrical lighting control',
    deviceCategories: ['dmx_controller', 'dmx_interface', 'dmx_gateway']
  },
  {
    id: 'av_integration',
    name: 'AV Integration',
    category: 'Integration',
    description: 'Audio/visual system integration for conference rooms, auditoriums, or presentation spaces',
    deviceCategories: ['av_interface', 'contact_closure', 'bridge', 'network_controller']
  },
  {
    id: 'critical_power',
    name: 'Critical Power',
    category: 'Power',
    description: 'Generator-backed critical power circuits for essential lighting',
    deviceCategories: ['relay_panel', 'transfer_switch', 'emergency_controller']
  },
  {
    id: 'emergency_power',
    name: 'Emergency Power',
    category: 'Power',
    description: 'Emergency generator or UPS-backed power for egress and emergency lighting',
    deviceCategories: ['emergency_relay', 'relay_panel', 'transfer_switch', 'emergency_controller']
  },
  {
    id: 'battery_backup',
    name: 'Battery Backup',
    category: 'Power',
    description: 'Battery backup units for emergency egress lighting (90-minute minimum per code)',
    deviceCategories: ['battery_backup', 'emergency_ballast', 'emergency_driver']
  },
  {
    id: 'dali_protocol',
    name: 'DALI Protocol',
    category: 'Integration',
    description: 'DALI (Digital Addressable Lighting Interface) protocol for luminaire-level control',
    deviceCategories: ['dali_controller', 'dali_gateway', 'dali_driver']
  },
  {
    id: 'scheduling',
    name: 'Time-Based Scheduling',
    category: 'Energy',
    description: 'Astronomical time clock or scheduling system for automated lighting scenes',
    deviceCategories: ['time_clock', 'scheduler', 'bridge', 'network_controller']
  },
  {
    id: 'dimming',
    name: 'Dimming Control',
    category: 'Controls',
    description: 'Continuous dimming capability (0-10V, DALI, or phase) for light level adjustment',
    deviceCategories: ['dimming_controller', 'dimming_driver', 'wallpod', 'keypad']
  }
];

/**
 * All device categories used in requirements matching.
 * The AI will classify BOM devices into these categories.
 */
const DEVICE_CATEGORIES = [
  'occupancy_sensor', 'ceiling_sensor', 'wall_sensor', 'vacancy_sensor',
  'photosensor', 'daylight_sensor',
  'wall_switch', 'wallpod', 'keypad', 'multi_level_switch',
  'dimming_controller', 'dimming_driver',
  'relay_panel', 'power_pack', 'power_supply',
  'bridge', 'network_controller',
  'time_clock', 'scheduler',
  'photocell',
  'emergency_relay', 'emergency_controller', 'transfer_switch', 'battery_backup', 'emergency_ballast', 'emergency_driver',
  'fire_alarm_relay',
  'bms_integration', 'bacnet_controller',
  'dmx_controller', 'dmx_interface', 'dmx_gateway',
  'av_interface', 'contact_closure',
  'dali_controller', 'dali_gateway', 'dali_driver',
  'demand_response',
  'wiring', 'cable',
  'other'
];

function getAllBuildingCodes() {
  return Object.values(BUILDING_CODES).map(code => ({
    id: code.id,
    name: code.name,
    description: code.description,
    version: code.version,
    requirementCount: code.requirements.length
  }));
}

function getBuildingCodeRequirements(codeId) {
  return BUILDING_CODES[codeId]?.requirements || [];
}

function getManualRequirements() {
  return MANUAL_REQUIREMENTS;
}

function aggregateRequirements(buildingCodeIds = [], manualRequirementIds = []) {
  const requirements = [];
  const seen = new Set();

  for (const codeId of buildingCodeIds) {
    const codeReqs = BUILDING_CODES[codeId]?.requirements || [];
    for (const req of codeReqs) {
      if (!seen.has(req.id)) {
        seen.add(req.id);
        requirements.push({ ...req, source: `code:${codeId}` });
      }
    }
  }

  for (const manualId of manualRequirementIds) {
    const manual = MANUAL_REQUIREMENTS.find(r => r.id === manualId);
    if (manual && !seen.has(manual.id)) {
      seen.add(manual.id);
      requirements.push({ ...manual, source: 'manual' });
    }
  }

  return requirements;
}

module.exports = {
  BUILDING_CODES,
  MANUAL_REQUIREMENTS,
  DEVICE_CATEGORIES,
  getAllBuildingCodes,
  getBuildingCodeRequirements,
  getManualRequirements,
  aggregateRequirements
};
