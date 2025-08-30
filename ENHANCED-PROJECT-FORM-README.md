# Enhanced Project Form - HTA Tool Replication

## Overview

This enhanced ProjectForm component replicates and improves upon the functionality of the original HTA (HTML Application) tool used for triage project creation. The form now includes comprehensive project creation features, advanced triage calculations, and enhanced export capabilities.

## Key Features

### 1. Complete RFA Type Support
- **BOM (No Layout)** - Basic bill of materials without layout
- **LAYOUT** - BOM with layout requirements
- **BUDGET** - Budget-focused BOM projects
- **SUBMITTAL** - Submittal projects (shows submittal section)
- **RELEASE** - Release/Preprogramming projects
- **RelocBOM/RelocSUB** - Relocation project types
- **RelocControlsBOM/RelocControlsSUB** - Relocation with controls
- **GRAPHICS** - Graphical interface projects
- **AtriusBOM/AtriusLayout** - Atrius-specific project types
- **AtriusSub/ControlsAtriusSub** - Atrius submittal projects
- **CONTROLSDCLAYOUT** - DC2DC controls layout
- **PHOTOMETRICS** - Photometric lighting layout
- **Consultation** - Design consultation projects

### 2. Enhanced Regional Team Selection
- **All** - Access to all regional DAS boards
- **Ontario** - Ontario regional team
- **IA** - Iowa regional team
- **Conyers** - Conyers regional team
- **Chicago** - Chicago regional team
- **Desktop Emergency Use only** - Emergency desktop mode

### 3. Comprehensive National Account Support
- **Default** - Standard account
- **ARBYS** - Arby's projects
- **BEALLS** - Bealls projects
- **CHICK FIL A** - Chick-fil-A projects
- **CHIPOTLE** - Chipotle projects
- **CRUMBL** - Crumbl Cookies projects
- **DAVE AND BUSTERS** - Dave & Busters projects
- **DAVITA** - Davita projects
- **DRIVE SHACK** - Drive Shack projects
- **DRYBAR** - Drybar projects
- **FLOOR AND DECOR** - Floor and Decor projects
- **FMC** - FMC projects
- **HOME DEPOT** - Home Depot projects
- **INPLANT OFFICE** - Inplant Office projects
- **JD SPORTS** - JD Sports projects
- **LEVIS** - Levi's projects
- **LUCKY BRANDS** - Lucky Brands projects
- **NORDSTROM RACK** - Nordstrom Rack projects
- **OFFICE DEPOT** - Office Depot projects
- **POTTERY BARN** - Pottery Barn projects
- **Raising Cane's** - Raising Cane's projects
- **REGUS** - Regus projects
- **TARGET** - Target projects
- **TD AMERITRADE** - TD Ameritrade projects
- **US BANK** - US Bank projects
- **WEST ELM** - West Elm projects
- **Sikorsky** - Sikorsky projects

### 4. Save Location Options
- **Triage** - Save to triage folder
- **Desktop** - Save to desktop
- **Server** - Save to server location

### 5. Advanced Triage Calculation

#### Panel Schedules
- **LMPs (Lighting Management Panels)**
  - Large LMPs: 45 minutes each
  - Medium LMPs: 30 minutes each
  - Small LMPs: 15 minutes each
- **nLight ARP (Advanced Relay Panel)**
  - ARP 8: 5 minutes each
  - ARP 16: 10 minutes each
  - ARP 32: 20 minutes each
  - ARP 48: 25 minutes each
- **E-Sheets Schedules Multiplier**
  - No: 2x multiplier
  - Yes: 1x multiplier

#### Layout Calculations
- **Room-based calculation**: `(Number of Rooms × Room Multiplier) ÷ 60 + Review/Setup + Spec Review`
- **Override option**: Direct hour input
- **Page bonus**: Additional time for projects with more than 3 lighting pages

#### Submittal Calculations
- **Riser-based calculation**: `(Number of Sub Rooms × Riser Multiplier) ÷ 60 + SOO`
- **Override option**: Direct hour input
- **SOO (Scope of Work)**: Additional time for submittal projects

#### Auto-calculation Features
- **Self-QC**: Automatically calculated based on total time
  - < 4 hours: 0.25 hours
  - 4-12 hours: 0.5 hours
  - ≥ 12 hours: 1 hour
- **Fluff**: Automatically calculated as 10% of base total
- **Final rounding**: Rounded to nearest 0.25 hours

### 6. Import from Agile
Enhanced clipboard parsing that automatically:
- Extracts RFA number, type, and agent number
- Identifies project name and container
- Determines revision status
- Sets appropriate room multipliers for budget projects
- Auto-detects national accounts based on project name
- Parses requested dates and ECDs

### 7. Export Capabilities

#### DAS Board Export
- Automatically determines RFA type tags (Q, B, G, R, S)
- Calculates project complexity (E, M, C) based on triage time
- Creates formatted project names for DAS board
- Copies to clipboard in tab-separated format

#### Agile Export
- Exports complete triage breakdown
- Includes all calculation components
- Formats data for Agile project management
- Copies to clipboard in structured format

#### DAS Board Access
- Direct links to regional DAS boards
- Opens appropriate board based on regional team selection
- Supports opening multiple boards for "All" selection

## Form Structure

### Basic Project Information
- Project Name (required)
- Project Container (required)
- RFA Number (required)
- Revision Type (New Project/Revision)
- RFA Type (required)
- Agent Number (required)
- Regional Team (required)
- National Account
- Save Location
- Requested Date
- ECD (Estimated Completion Date)

### Panel Schedules Section
- Toggle for including panel schedules
- LMP quantities (Large, Medium, Small)
- ARP quantities (8, 16, 32, 48)
- E-Sheets schedules multiplier

### Layout Section
- Number of rooms and override options
- Room multiplier settings
- Review/Setup time
- Number of lighting pages
- Specification review time

### Submittal Section (Conditional)
- Number of sub rooms and override options
- Riser multiplier settings
- SOO (Scope of Work) time

### Triage Results
- Real-time calculation display
- Breakdown of all time components
- Total triage time with automatic rounding

## Technical Implementation

### State Management
- Comprehensive form state with all HTA fields
- Real-time triage calculations
- Conditional section visibility
- Enhanced validation

### Auto-calculation Triggers
- Panel schedule changes
- Room quantity updates
- Multiplier adjustments
- Override value changes

### Responsive Design
- Mobile-friendly layout
- Adaptive grid systems
- Touch-friendly controls
- Responsive typography

### Accessibility Features
- Proper form labeling
- Error message display
- Required field indicators
- Keyboard navigation support

## Usage Instructions

### 1. Creating a New Project
1. Fill in required basic information
2. Select appropriate RFA type
3. Choose regional team and save location
4. Configure panel schedules if needed
5. Set layout parameters
6. Review auto-calculated triage results
7. Submit project

### 2. Importing from Agile
1. Copy RFA information from Agile
2. Click "Import From Agile" button
3. Review auto-populated fields
4. Adjust any incorrect values
5. Complete remaining required fields

### 3. Exporting Data
1. **DAS Board**: Click "Copy to DAS Board" to copy formatted data
2. **Agile**: Click "Copy to Agile" to copy triage breakdown
3. **DAS Board Access**: Click "Open DAS Board" to access regional boards

### 4. Triage Calculations
- All calculations happen automatically as you type
- Override fields take precedence over calculated values
- Results are displayed in real-time
- Final time is automatically rounded to nearest 0.25 hours

## Validation Rules

### Required Fields
- Project Name
- RFA Number
- Agent Number
- Project Container
- RFA Type
- Regional Team

### Data Validation
- Numeric fields accept only valid numbers
- Date fields require proper format
- RFA types must match predefined options
- Agent numbers are validated for format

## Error Handling

### Form Validation
- Real-time field validation
- Clear error messages
- Visual error indicators
- Submission prevention for invalid data

### Calculation Errors
- Graceful handling of division by zero
- Default values for missing data
- Fallback calculations for edge cases

## Browser Compatibility

### Supported Browsers
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Required Features
- ES6+ support
- Clipboard API
- CSS Grid
- Flexbox

## Performance Considerations

### Optimization Features
- Debounced calculation updates
- Efficient state management
- Minimal re-renders
- Optimized calculation algorithms

### Memory Management
- Cleanup of event listeners
- Proper state cleanup
- Efficient data structures

## Future Enhancements

### Planned Features
- Project template management
- Batch project creation
- Advanced reporting
- Integration with external systems
- Enhanced validation rules
- Custom calculation formulas

### User Experience Improvements
- Drag-and-drop file uploads
- Advanced search and filtering
- Project history tracking
- Collaborative editing
- Real-time collaboration

## Troubleshooting

### Common Issues

#### Import Not Working
- Ensure clipboard contains valid RFA data
- Check browser clipboard permissions
- Verify data format matches expected structure

#### Calculations Not Updating
- Check for invalid numeric inputs
- Ensure all required fields are filled
- Refresh page if persistent issues occur

#### Export Failures
- Verify clipboard permissions
- Check browser compatibility
- Ensure all required data is present

### Debug Information
- Console logging for all major operations
- Error tracking for failed operations
- Validation feedback for user inputs
- Performance metrics for calculations

## Support and Maintenance

### Code Organization
- Modular component structure
- Clear separation of concerns
- Comprehensive error handling
- Extensive documentation

### Testing
- Unit tests for calculations
- Integration tests for form flow
- User acceptance testing
- Cross-browser compatibility testing

### Updates
- Regular feature updates
- Bug fixes and improvements
- Performance optimizations
- Security updates

---

This enhanced ProjectForm component provides a modern, user-friendly interface that replicates all the functionality of the original HTA tool while adding improvements in usability, validation, and user experience. The form is designed to be intuitive for users familiar with the HTA tool while providing enhanced features for power users.
