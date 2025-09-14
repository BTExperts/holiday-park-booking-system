# 🚀 Holiday Park Booking System - Deployment Guide

## 📋 Quick Start

### Prerequisites
- Node.js 16+ installed
- Modern web browser
- Basic command line knowledge

### Installation Steps

1. **Extract Project Files**
   ```bash
   unzip HolidayParkBookingSystem.zip
   cd holiday-park-booking-system
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access Application**
   - Open browser to `http://localhost:5173`
   - Application will load with demo data

## 🏗️ Production Deployment

### Build for Production
```bash
npm run build
```

### Deploy Built Files
- Copy `dist/` folder contents to web server
- Ensure server supports SPA routing
- Configure HTTPS for production use

### Environment Variables
- No environment variables required
- All configuration is in code

## 🔧 Configuration

### Room Types & Pricing
Edit `src/components/HeaderOnly.jsx` lines 1060-1063:
```javascript
const [localRooms, setLocalRooms] = useState([
  ...poweredSites.map(id => ({id, name: id, type: 'powered', nightlyRate: 55, weeklyRate: 240, lastReading: 0})),
  ...cabins.map(id => ({id, name: id, type: 'cabin', nightlyRate: 90, weeklyRate: 450, lastReading: 0})),
  ...permanents.map(id => ({id, name: id, type: 'permanent', nightlyRate: 0, weeklyRate: 220, lastReading: 0}))
]);
```

### Site Definitions
Edit room arrays in `src/components/HeaderOnly.jsx`:
- `poweredSites`: Array of powered site IDs
- `cabins`: Array of cabin IDs  
- `permanents`: Array of permanent site IDs

## 📊 Data Management

### Backup Data
- Data automatically saves to browser localStorage
- Export data regularly using built-in export feature
- Backup files are JSON format

### Restore Data
- Use import feature in application
- Supports JSON backup files
- Validates data integrity on import

## 🛠️ Troubleshooting

### Common Issues

**Application won't start:**
- Check Node.js version (16+)
- Run `npm install` again
- Clear node_modules and reinstall

**Data not persisting:**
- Check browser localStorage is enabled
- Clear browser cache and cookies
- Export data before clearing

**Calendar not loading:**
- Check browser console for errors
- Ensure JavaScript is enabled
- Try different browser

**Performance issues:**
- Close other browser tabs
- Clear browser cache
- Restart development server

### Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📱 Mobile Usage

### Responsive Design
- Optimized for touch devices
- Swipe navigation supported
- Touch-friendly buttons and inputs

### Mobile Features
- Calendar scrolls horizontally
- Booking creation via touch
- Client management accessible
- Power meter readings supported

## 🔒 Security Considerations

### Data Protection
- All data stored locally in browser
- No server-side data transmission
- Regular backups recommended
- Secure browser environment needed

### Access Control
- No built-in user authentication
- Physical access control required
- Browser security settings important
- Regular data exports for backup

## 📈 Performance Optimization

### Large Datasets
- System handles 1000+ bookings
- Efficient React rendering
- Optimized state management
- Minimal memory usage

### Storage Management
- localStorage has ~5-10MB limit
- Regular data cleanup recommended
- Export old data periodically
- Monitor storage usage

## 🔄 Updates & Maintenance

### Updating Application
1. Backup current data
2. Replace application files
3. Restore data from backup
4. Test functionality

### Regular Maintenance
- Export data weekly
- Clear browser cache monthly
- Update browser regularly
- Monitor storage usage

## 📞 Support

### Getting Help
- Check troubleshooting section
- Review documentation
- Contact development team
- Report bugs with details

### Feature Requests
- Submit detailed requests
- Include use cases
- Provide examples
- Consider impact on existing features

---

**Deployment Version**: 1.0.0  
**Last Updated**: December 2024  
**Compatibility**: Modern browsers with ES6+ support
