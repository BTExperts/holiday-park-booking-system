import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, useMemo, memo } from 'react';
import { Button } from './components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select';
import { toast } from 'sonner';
import apiService from './services/api';
import PaymentLedger from './components/PaymentLedger';

// Site type icon function
const typeIcon = (t) => {
  if (t === 'powered') return '⚡';
  if (t === 'cabin') return '🏠';
  if (t === 'permanent') return '🏢';
  return '🏕️';
};

// Toggle function for type visibility
const toggleTypeVisible = (type, setTypeVisible) => {
  setTypeVisible(prev => ({
    ...prev,
    [type]: !prev[type]
  }));
};

// Date utility functions
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Additional date utilities from Full App
const sod = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const normalizeRange = (a,b) => { const da=sod(new Date(a)), db=sod(new Date(b)); return da<=db ? [da, addDays(db,1)] : [db, addDays(da,1)]; };
const nightsBetween = (start, end) => Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));

const formatDateDisplay = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return {
    dayName: days[date.getDay()],
    dayNumber: date.getDate(),
    month: months[date.getMonth()],
    year: date.getFullYear()
  };
};

const formatTooltipDate = (date) => {
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  return {
    fullDayName: fullDays[date.getDay()],
    fullDate: `${date.getDate().toString().padStart(2, '0')} ${fullMonths[date.getMonth()]} ${date.getFullYear()}`
  };
};

const dateKey = (date) => {
  if (typeof date === 'string') return date;
  return formatDate(date);
};


const InfiniteCalendarGrid = React.forwardRef(({ 
  typeVisible, 
  setTypeVisible,
  toggleTypeVisible, 
  selection, 
  onCellClick, 
  bookings, 
  setBookings,
  barDrag,
  setBarDrag,
  startBarDrag,
  roomsData,
  gridMetricsRef,
  dragging,
  handleMouseDown,
  dragRoomRef,
  dragStartRef,
  setSelection,
  handleBookingClick,
  setCellTooltip,
  setTooltipPosition,
  validateDateRange
}, ref) => {
  const [dates, setDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef(null);
  const leftSidebarRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const isScrollSyncing = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  
  // Hover state for row and column highlighting
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  
  // Reset function ref to expose to parent
  const resetToTodayRef = useRef(null);

  // Helper function to ensure unique dates by ISO string
  const getUniqueDates = (dateArray) => {
    const seen = new Set();
    return dateArray.filter(dateObj => {
      if (seen.has(dateObj.iso)) {
        console.warn('Duplicate date found:', dateObj.iso);
        return false;
      }
      seen.add(dateObj.iso);
      return true;
    });
  };

  // Sample bookings with varying payment amounts (August-September 2025)
  // Note: bookings are now passed as props from parent component



  const pricingFor = (booking) => {
    const room = roomsData.find(r => r.id === booking.roomId);
    if (!room) return { nightly: 0, weekly: 0, nights: 0, total: 0 };
    
    let nightly = room.nightlyRate || 0;
    let weekly = room.weeklyRate || 0;
    
    const nights = nightsBetween(booking.startDate, booking.endDate);
    const weeks = Math.floor(nights / 7);
    const remainingNights = nights % 7;
    
    const total = weeks * weekly + remainingNights * nightly;
    
    return { nightly, weekly, nights, total };
  };

  const getBookingStatus = (booking, todayISO) => {
    const isFuture = todayISO < booking.startDate;
    const isPast = todayISO >= booking.endDate;
    const isInHouse = todayISO >= booking.startDate && todayISO < booking.endDate;
    
    // Use the new totalAmount and totalPaid fields from the booking
    const totalAmount = booking.totalAmount || 0;
    const amountPaid = booking.totalPaid || 0;
    const paidInFull = amountPaid >= totalAmount;
    
    // Simple overdue calculation - if in house or past and not fully paid
    const overdue = (isInHouse || isPast) && !paidInFull;
    
    let bgClass = "bg-blue-200";
    let statusText = "Upcoming";
    
    if (isFuture) { 
      bgClass = "bg-blue-200"; 
      statusText = "Upcoming"; 
    }
    else if (isPast && paidInFull) { 
      bgClass = "bg-gray-300"; 
      statusText = "Past stay (paid)"; 
    }
    else if (paidInFull) { 
      bgClass = "bg-emerald-200"; 
      statusText = "Paid in full"; 
    }
    else if (overdue) { 
      bgClass = "bg-rose-200"; 
      statusText = "Overdue"; 
    }
    else { 
      bgClass = "bg-amber-200"; 
      statusText = "Partially paid"; 
    }
    
    return { bgClass, statusText, amountPaid, totalAmount, paidInFull };
  };

  // Formatting functions
  const fmtAUD = (amount) => `$${amount.toFixed(2)}`;
  const fmtAUDNoCentsWhen00 = (amount) => amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
  const fmtLongDate = (iso) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const addDaysIso = (iso, days) => {
    if (!iso || isNaN(new Date(iso).getTime())) {
      console.warn('Invalid ISO date:', iso);
      return iso; // Return original if invalid
    }
    const date = new Date(iso);
    date.setDate(date.getDate() + days);
    return formatDate(date);
  };

  // Generate initial dates (current date ± 4 weeks)
  useEffect(() => {
    const generateInitialDates = () => {
      const today = new Date();
      const initialDates = [];
      
      // Generate a range from August 1, 2025 to October 31, 2025 to cover demo bookings
      const startDate = new Date(2025, 7, 1); // August 1, 2025
      const endDate = new Date(2025, 9, 31); // October 31, 2025
      
      for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        const isToday = formatDate(d) === formatDate(today);
        initialDates.push({
          date: new Date(d),
          iso: formatDate(d),
          isToday: isToday,
          display: formatDateDisplay(d)
        });
      }
      
      // Ensure unique dates and sort chronologically
      const uniqueDates = getUniqueDates(initialDates);
      uniqueDates.sort((a, b) => new Date(a.iso) - new Date(b.iso));
      setDates(uniqueDates);
      
      // Set initial scroll position to center on current date
      const scrollToToday = () => {
        if (scrollContainerRef.current) {
          const todayIndex = uniqueDates.findIndex(d => d.isToday);
          const containerWidth = scrollContainerRef.current.clientWidth;
          const columnWidth = 120; // 120px per day column
          const todayPosition = todayIndex * columnWidth;
          
          // Position today's date at 25% from the left (more future dates visible)
          const scrollTo = todayPosition - (containerWidth * 0.25) + (columnWidth / 2);
          
          scrollContainerRef.current.scrollLeft = Math.max(0, scrollTo);
          setScrollPosition(scrollTo);
          
          // Also sync the bottom scrollbar
          if (bottomScrollRef.current) {
            bottomScrollRef.current.scrollLeft = scrollTo;
          }
        }
      };
      
      // Try immediately, then with delays as fallbacks for page refresh
      scrollToToday();
      setTimeout(scrollToToday, 100);
      setTimeout(scrollToToday, 500);
    };

    generateInitialDates();
  }, []);

  // Handle vertical scroll sync only
  const handleVerticalScroll = useCallback((e) => {
    if (isScrollSyncing.current) return;
    
    const container = e.target;
    const scrollTop = container.scrollTop;
    
    // Set scrolling state
    setIsScrolling(true);
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    isScrollSyncing.current = true;
    
    // Sync vertical scroll between left sidebar and right side
    if (container === scrollContainerRef.current && leftSidebarRef.current) {
      leftSidebarRef.current.scrollTop = scrollTop;
    } else if (container === leftSidebarRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollTop;
    }
    
    // Reset sync flag after a short delay
    setTimeout(() => {
      isScrollSyncing.current = false;
    }, 10);
  }, []);

  // Handle horizontal scroll and infinite loading
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    // Set scrolling state for horizontal scroll too
    setIsScrolling(true);
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    // Only update scroll position for horizontal scroll from the main container
    if (container === scrollContainerRef.current) {
      setScrollPosition(scrollLeft);
    }
    
    // Sync horizontal scroll with bottom scrollbar (only for horizontal scrolling containers)
    if (container === scrollContainerRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = scrollLeft;
    } else if (container === bottomScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft;
    }
    
    // Also handle vertical scroll sync for the main container
    handleVerticalScroll(e);
    
    // Load more dates when scrolling near the edges
    const threshold = 300; // Increased threshold for smoother loading
    
    if (scrollLeft < threshold && !isLoading) {
      // Load older dates
      setIsLoading(true);
      
      const oldestDate = dates[0].date;
      const newDates = [];
      
      for (let i = -14; i < 0; i++) {
        const date = addDays(oldestDate, i);
        const isToday = formatDate(date) === formatDate(new Date());
        newDates.push({
          date: date,
          iso: formatDate(date),
          isToday: isToday,
          display: formatDateDisplay(date)
        });
      }
      
      setDates(prev => getUniqueDates([...newDates, ...prev]));
      
      // Smooth scroll position adjustment
      requestAnimationFrame(() => {
        const newScrollPosition = scrollLeft + (newDates.length * 120);
        container.scrollTo({
          left: newScrollPosition,
          behavior: 'auto' // Instant but smooth
        });
        setScrollPosition(newScrollPosition);
        setIsLoading(false);
      });
    }
    
    if (scrollLeft + clientWidth > scrollWidth - threshold && !isLoading) {
      // Load newer dates
      setIsLoading(true);
      
      const newestDate = dates[dates.length - 1].date;
      const newDates = [];
      
      for (let i = 1; i <= 14; i++) {
        const date = addDays(newestDate, i);
        const isToday = formatDate(date) === formatDate(new Date());
        newDates.push({
          date: date,
          iso: formatDate(date),
          isToday: isToday,
          display: formatDateDisplay(date)
        });
      }
      
      setDates(prev => getUniqueDates([...prev, ...newDates]));
      
      // Smooth loading completion
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }
  }, [dates, isLoading]);

  // Reset to today function
  const resetToToday = useCallback(() => {
    
    // Reset to initial date range (August 1, 2025 to October 31, 2025)
    const today = new Date();
    const initialDates = [];
    
    // Generate a range from August 1, 2025 to October 31, 2025 to cover demo bookings
    const startDate = new Date(2025, 7, 1); // August 1, 2025
    const endDate = new Date(2025, 9, 31); // October 31, 2025
    
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
      const isToday = formatDate(d) === formatDate(today);
      initialDates.push({
        date: new Date(d),
        iso: formatDate(d),
        isToday: isToday,
        display: formatDateDisplay(d)
      });
    }
    
    const uniqueDates = getUniqueDates(initialDates);
    uniqueDates.sort((a, b) => new Date(a.iso) - new Date(b.iso));
    setDates(uniqueDates);
    
    // Scroll to today's position immediately using the new dates
    const todayIndex = uniqueDates.findIndex(d => d.isToday);
    
    if (todayIndex !== -1 && scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const columnWidth = 120;
      const todayPosition = todayIndex * columnWidth;
      const scrollTo = todayPosition - (containerWidth * 0.25) + (columnWidth / 2);
      
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            left: Math.max(0, scrollTo),
            behavior: 'smooth'
          });
          
          // Also sync the bottom scrollbar
          if (bottomScrollRef.current) {
            bottomScrollRef.current.scrollLeft = scrollTo;
          }
        }
      });
    }
  }, []); // Remove dates dependency

  // Bar drag useEffect (from full app)
  useEffect(() => {
    if (!barDrag) return;
    
    const onMove = (e) => {
      if (!barDrag.activated) {
        const dx = e.clientX - (barDrag.startClientX || 0);
        const dy = e.clientY - (barDrag.startClientY || 0);
        if (Math.hypot(dx, dy) < 4) return;
        setBarDrag(prev => ({ ...prev, activated: true }));
        return;
      }
      
      const m = gridMetricsRef.current;
      
      // Safety check for grid metrics
      if (!m || !m.cellW || !m.rowH) {
        console.error('Grid metrics not available during bar drag');
        return;
      }
      
      const rawCol = (e.clientX - m.left) / m.cellW;
      const baseCol = Math.floor(rawCol);
      const clampCol = (c) => Math.max(0, Math.min(dates.length - 1, c));
      let col = clampCol(baseCol);
      const row = Math.max(0, Math.min(roomsData.length - 1, Math.floor((e.clientY - m.top) / m.rowH)));
      
      let start = barDrag.originStart;
      let end = barDrag.originEnd;
      let roomId = barDrag.originRoomId;
      // Safety check for dates array
      if (!dates || dates.length === 0) {
        console.error('Dates array not available during bar drag');
        return;
      }
      
      // Safety check for roomsData array
      if (!roomsData || roomsData.length === 0) {
        console.error('RoomsData array not available during bar drag');
        return;
      }
      
      const dur = nightsBetween(barDrag.originStart, barDrag.originEnd);
      
      // Apply deadzone so resize requires dragging further into the next/previous day
      const DEADZONE = 0.34; // about one-third of a cell
      if (barDrag.type === 'resize-end') {
        col = clampCol(Math.floor(rawCol - DEADZONE));
      } else if (barDrag.type === 'resize-start') {
        col = clampCol(Math.floor(rawCol + DEADZONE));
      }
      
      const hitISO = dates[col];
      
      if (barDrag.type === 'move') {
        const startIdx = clampCol(Math.floor(rawCol - (barDrag.offsetCols || 0)));
        const iso = dates[startIdx];
        if (!iso) {
          console.warn('No date found at index:', startIdx);
          return;
        }
        
        start = iso.iso || iso; // Handle both object and string formats
        end = addDaysIso(start, dur);
        
        roomId = roomsData[row].id;
      } else if (barDrag.type === 'resize-start') {
        const maxStart = addDaysIso(barDrag.originEnd, -1);
        const hitDate = hitISO?.iso || hitISO;
        start = hitDate < maxStart ? hitDate : maxStart;
      } else if (barDrag.type === 'resize-end') {
        const minEnd = addDaysIso(barDrag.originStart, 1);
        const hitDate = hitISO?.iso || hitISO;
        const candidateEnd = addDaysIso(hitDate, 1);
        end = candidateEnd > minEnd ? candidateEnd : minEnd;
      }
      
      const hasConflict = bookings.some(x => 
        x.id !== barDrag.bookingId && 
        x.roomId === roomId && 
        !(end <= x.start || start >= x.end)
      );
      
      setBarDrag(prev => ({
        ...prev,
        previewStart: start,
        previewEnd: end,
        previewRoomId: roomId,
        conflict: hasConflict
      }));
    };
    
    const onUp = () => {
      if (barDrag) {
        if (!barDrag.activated) {
          setBarDrag(null);
          return;
        }
        
        const unchanged = 
          barDrag.previewStart === barDrag.originStart && 
          barDrag.previewEnd === barDrag.originEnd && 
          barDrag.previewRoomId === barDrag.originRoomId;
        
        if (barDrag.conflict) {
          console.error('Cannot move/resize: conflicts with another booking.');
        } else if (unchanged) {
          // Do nothing if unchanged
        } else {
          // Validate date range before applying changes
          const validation = validateDateRange(barDrag.previewStart, barDrag.previewEnd);
          if (!validation.isValid) {
            alert(validation.message);
            setBarDrag(null);
            return;
          }
          
          const r = roomsData.find(rr => rr.id === barDrag.previewRoomId);
          const n = nightsBetween(barDrag.previewStart, barDrag.previewEnd);
          
          if (r?.type === 'permanent' && (n % 7 !== 0)) {
            console.error('Permanent sites must be booked in 7-night blocks.');
          } else {
            setBookings(prev => prev.map(x => 
              x.id === barDrag.bookingId 
                ? { ...x, start: barDrag.previewStart, end: barDrag.previewEnd, roomId: barDrag.previewRoomId }
                : x
            ));
          }
        }
      }
      setBarDrag(null);
    };
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [barDrag, dates, roomsData, bookings]);

  // Mouse move handler for drag-to-create (using Full App logic)
  const handleMouseMove = (e) => {
    if (!dragging || !dragRoomRef.current || barDrag) {
      return;
    }
    
    if (!e.currentTarget || typeof e.currentTarget.getBoundingClientRect !== 'function') {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = e.currentTarget.scrollLeft;
    const adjustedX = x + scrollLeft;
    const columnIndex = Math.floor(adjustedX / 120);
    
    if (columnIndex >= 0 && columnIndex < dates.length) {
      const targetDate = dates[columnIndex];
      
      // Fixed logic: handle both left and right dragging properly
      const initialDate = new Date(dragStartRef.current);
      const currentDate = new Date(targetDate.iso);
      
      // Use the normalizeRange function to handle both directions correctly
      // But don't add an extra day - make checkout day the actual clicked day
      const da = new Date(dragStartRef.current);
      da.setHours(0, 0, 0, 0);
      const db = new Date(targetDate.iso);
      db.setHours(0, 0, 0, 0);
      const [s, e2] = da <= db ? [da, db] : [db, da];
      
      // Ensure minimum 1-night stay by adding 1 day to end if needed
      const nights = Math.ceil((e2 - s) / (1000 * 60 * 60 * 24));
      const finalEndDate = nights < 1 ? addDays(s, 1) : e2;
      
      const newSelection = {
        roomId: dragRoomRef.current,
        startDate: dateKey(s),
        endDate: dateKey(finalEndDate)
      };
      
      setSelection(newSelection);
    }
  };

  // Set up mouse move listener for drag-to-create
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [dragging, handleMouseMove]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Set the reset function in the ref
  resetToTodayRef.current = resetToToday;

  // Expose the resetToTodayRef through the forwarded ref
  useImperativeHandle(ref, () => ({
    resetToTodayRef
  }));

  return (
    <div className="mt-1">
      <style>{`
        @keyframes pulse-bg {
          0%, 100% { background-color: rgb(254 242 242); }
          50% { background-color: rgb(252 165 165); }
        }
        .pulse-bg {
          animation: pulse-bg 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .hide-scrollbar {
          /* Hide scrollbar for Chrome, Safari and Opera */
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* Internet Explorer 10+ */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none; /* WebKit */
        }
      `}</style>
      <div className="bg-white border rounded-lg shadow-sm">
        {/* Calendar Grid with Rooms */}
        <div className="relative" style={{ height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
          <div className="flex h-full">
            {/* Fixed Left Sidebar - Room List */}
            <div 
              ref={leftSidebarRef}
              className="w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 overflow-y-auto hide-scrollbar"
              onScroll={handleVerticalScroll}
            >
              {/* Sites Header */}
              <div className="flex-shrink-0 w-30 p-3 bg-gray-100 border-r-2 border-gray-300 border-b-2 border-gray-300 text-center sticky top-0 z-30" style={{ minWidth: '256px', height: '118px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="text-2xl font-bold text-gray-700">Sites</div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {(['powered','cabin','permanent']).map((t)=> (
                    <button key={t} type="button" aria-label={`${t} filter`} className={`px-1.5 py-0.5 rounded border flex items-center justify-center transition-colors duration-300 ${typeVisible[t] ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : `text-rose-700 border-rose-300 ${!typeVisible[t] ? 'pulse-bg' : 'bg-rose-50'}`}`} onClick={()=>toggleTypeVisible(t, setTypeVisible)} title={`${t.charAt(0).toUpperCase()+t.slice(1)}: ${typeVisible[t]?'visible':'collapsed'}`}>
                      <span className="relative inline-flex items-center justify-center w-8 h-8">
                        <span className="text-xl leading-none">{typeIcon(t)}</span>
                        <svg className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${typeVisible[t] ? 'opacity-0' : 'opacity-100'}`} viewBox="0 0 20 20" preserveAspectRatio="none">
                          <line x1="1" y1="19" x2="19" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" style={{ strokeDashoffset: typeVisible[t] ? 28 : 0, transition: 'stroke-dashoffset 300ms ease' }} />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Room List */}
              {roomsData.filter(r => typeVisible[r.type]).map((room) => (
                <div 
                  key={room.id} 
                  className={`p-3 border-b border-gray-200 border-r-2 border-gray-300 transition-colors duration-150 ${
                    hoveredRow === room.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                  }`} 
                  style={{ minHeight: '60px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={() => !isScrolling && setHoveredRow(room.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className="text-lg leading-none mt-0.5" aria-hidden>
                      {typeIcon(room.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900 truncate">{room.name}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {room.type} · {room.nightlyRate ? `$${room.nightlyRate}/night` : '—'} · {room.weeklyRate ? `$${room.weeklyRate}/wk` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Scrollable Right Side - Date Grid */}
            <div 
              ref={scrollContainerRef}
              className={`flex-1 overflow-x-auto overflow-y-auto ${dragging ? 'cursor-grabbing' : 'cursor-default'}`}
              onScroll={handleScroll}
              onMouseMove={handleMouseMove}
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}
            >
              {/* Date Header Row */}
              <div className="flex min-w-max sticky top-0 z-[100] bg-white">
                {dates.map((dateInfo, index) => (
                  <div
                    key={`header-${dateInfo.iso}`}
                    className={`flex-shrink-0 w-30 p-3 border-r border-gray-200 border-b-2 border-gray-300 text-center transition-colors duration-150 ${
                      hoveredColumn === dateInfo.iso ? 'bg-blue-100' : 
                      dateInfo.isToday ? 'bg-yellow-50' : 'bg-white hover:bg-gray-50'
                    }`}
                    style={{ minWidth: '120px', height: '118px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                    onMouseEnter={() => !isScrolling && setHoveredColumn(dateInfo.iso)}
                    onMouseLeave={() => setHoveredColumn(null)}
                  >
                    <div className={`text-xs font-medium ${dateInfo.isToday ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {dateInfo.display.dayName}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${dateInfo.isToday ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {dateInfo.display.dayNumber}
                    </div>
                    <div className={`text-xs ${dateInfo.isToday ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {dateInfo.display.month} {dateInfo.display.year}
                    </div>
                    {dateInfo.isToday && (
                      <div className="mt-2">
                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Room Rows with Grid Cells */}
              {roomsData.filter(r => typeVisible[r.type]).map((room) => (
                <div key={`row-${room.id}`} className="flex min-w-max border-b border-gray-200 relative">
                  {/* Date cells */}
                  {dates.map((dateInfo, index) => {
                    const isFirstCell = room.id === roomsData.filter(r => typeVisible[r.type])[0]?.id && index === 0;
                    return (
                      <div
                        key={`cell-${room.id}-${dateInfo.iso}`}
                        data-grid-firstcell={isFirstCell ? "1" : undefined}
                        data-room-id={room.id}
                        data-date-iso={dateInfo.iso}
                        className={`flex-shrink-0 w-30 p-2 border-r border-gray-200 transition-colors duration-150 cursor-pointer ${
                          hoveredRow === room.id && hoveredColumn === dateInfo.iso ? 'bg-blue-200' :
                          hoveredRow === room.id ? 'bg-blue-100' :
                          hoveredColumn === dateInfo.iso ? 'bg-blue-100' :
                          dateInfo.isToday ? 'bg-yellow-50/30' : 'bg-white hover:bg-gray-50'
                        }`}
                        style={{ minWidth: '120px', minHeight: '60px' }}
                        onMouseEnter={(e) => {
                          if (!isScrolling) {
                            setHoveredRow(room.id);
                            setHoveredColumn(dateInfo.iso);
                            // Only show tooltip if not dragging
                            if (!dragging) {
                              const date = new Date(dateInfo.iso);
                              const tooltipData = {
                                ...formatTooltipDate(date),
                                siteName: room.name
                              };
                              setCellTooltip(tooltipData);
                              setTooltipPosition({ x: e.clientX, y: e.clientY });
                            }
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredRow(null);
                          setHoveredColumn(null);
                          // Only clear tooltip if not dragging
                          if (!dragging) {
                            setCellTooltip(null);
                          }
                        }}
                        onMouseDown={(e) => handleMouseDown(room.id, dateInfo.iso, e)}
                        onClick={(e) => onCellClick(room.id, dateInfo.iso, e)}
                      >
                        {/* Empty cell indicator */}
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          {/* Empty cell */}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Render bookings spanning multiple days */}
                  {bookings.filter(b => b.roomId === room.id).map((booking) => {
                    
                    const todayISO = formatDate(new Date());
                    const status = getBookingStatus(booking, todayISO);
                    const price = pricingFor(booking);
                    const paidFrac = status.totalAmount > 0 ? status.amountPaid / status.totalAmount : 0;
                    
                    // Find start and end positions in the dates array
                    const startIndex = dates.findIndex(d => d.iso === booking.startDate);
                    const endIndex = dates.findIndex(d => d.iso === booking.endDate);
                    
                    if (startIndex === -1 || endIndex === -1) return null;
                    
                    // For visual positioning, booking starts on check-in day and ends on check-out day
                    const visualStartIndex = startIndex;
                    const visualEndIndex = endIndex;
                    
                    // Calculate start and end percentages to show nights properly
                    // Start at 50% into the first day (check-in time)
                    const startPerc = 50; // 50% into the first day
                    // End at 30% into the last day (check-out time) - creates gap between bookings
                    const endPerc = 30; // 30% into the last day
                    
                    const nightsVisible = visualEndIndex - visualStartIndex + 1;
                    const startOffset = (startPerc / 100) * 120; // 50% of 120px = 60px
                    const endOffset = (endPerc / 100) * 120; // 30% of 120px = 36px
                    
                    // Calculate width: full width minus start offset minus remaining space at end
                    const fullWidth = nightsVisible * 120;
                    const remainingEndSpace = 120 - endOffset; // 120 - 36 = 84px
                    const bookingWidth = fullWidth - startOffset - remainingEndSpace;
                    
                    return (
                      <div
                        key={`booking-${booking.id}`}
                        className="absolute inset-y-0 z-[70] overflow-visible pointer-events-none"
                        style={{ 
                          left: `${visualStartIndex * 120 + startOffset}px`, 
                          width: `${bookingWidth}px`,
                          height: '60px'
                        }}
                      >
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-auto">
                          <div 
                            className={`relative z-[70] w-full ${status.bgClass} rounded-md shadow-sm px-3 py-2 select-none group cursor-pointer`}
                            style={{ height: '54px' }}
                            title={`${booking.guestName} - $${status.totalAmount.toFixed(2)} Total - ${status.amountPaid >= status.totalAmount ? 
                              (status.amountPaid > status.totalAmount ? 
                                `Overpaid by $${(status.amountPaid - status.totalAmount).toFixed(2)}` : 
                                'Fully Paid'
                              ) : 
                              `$${status.amountPaid.toFixed(2)} paid`
                            }`}
                            onMouseDown={(e) => startBarDrag(booking, 'move', e, dates)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookingClick(booking);
                            }}
                          >
                            {/* Resize handles (from full app) */}
                            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => startBarDrag(booking, 'resize-start', e, dates)} />
                            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => startBarDrag(booking, 'resize-end', e, dates)} />
                            {/* Payment status strip */}
                            <div className="absolute left-0 right-0 top-0 z-40 pointer-events-none">
                              <div className="absolute -top-1 left-0 right-0 h-3 z-50 pointer-events-auto" />
                              <div className="h-1 overflow-visible">
                                <div className="flex w-full h-full">
                                  {paidFrac > 1 ? (
                                    // Overpaid - show blue for overpayment amount
                                    <>
                                      <div 
                                        className="bg-emerald-500 h-full" 
                                        style={{ width: '100%' }} 
                                      />
                                      <div 
                                        className="bg-blue-500 h-full" 
                                        style={{ width: `${Math.round((paidFrac - 1) * 100)}%` }} 
                                      />
                                    </>
                                  ) : (
                                    // Normal payment status
                                    <>
                                      <div 
                                        className="bg-emerald-500 h-full" 
                                        style={{ width: `${Math.round(paidFrac * 100)}%` }} 
                                      />
                                      <div 
                                        className="bg-rose-500 h-full" 
                                        style={{ width: `${100 - Math.round(paidFrac * 100)}%` }} 
                                      />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Booking content - matching full app styling */}
                            <div className="text-[12px] truncate js-line1">
                              {(booking.checkedOut ? "🗄️ " : (booking.checkedIn ? "✅ " : ""))}
                              {(() => {
                                const totalAmount = booking.totalAmount || 0;
                                const amountPaid = booking.totalPaid || 0;
                                const netAmount = totalAmount - amountPaid;
                                
                                if (netAmount < 0) return "💰 "; // Overpaid
                                if (netAmount === 0 && amountPaid > 0) return "✅ "; // Fully paid
                                if (netAmount > 0 && amountPaid > 0) return "⚠️ "; // Partially paid
                                return ""; // No payments
                              })()}
                              <span className="font-semibold text-[1.35em]">{booking.guestName}</span>
                              <span className="opacity-70 font-normal"> · ({price.nights} night{price.nights===1?"":"s"})</span>
                            </div>
                            <div className="text-[11px] truncate js-line2">
                              {fmtLongDate(booking.startDate)} – {fmtLongDate(booking.endDate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Render drag preview */}
                  {barDrag && barDrag.activated && barDrag.previewStart && barDrag.previewEnd && barDrag.previewRoomId === room.id && (() => {
                    // Validate preview dates before showing
                    const validation = validateDateRange(barDrag.previewStart, barDrag.previewEnd);
                    if (!validation.isValid) {
                      return null; // Don't show preview for invalid dates
                    }
                    
                    const previewBooking = bookings.find(b => b.id === barDrag.bookingId);
                    if (!previewBooking) return null;
                      
                      const todayISO = formatDate(new Date());
                      const status = getBookingStatus(previewBooking, todayISO);
                      const price = pricingFor(previewBooking);
                      const paidFrac = status.totalAmount > 0 ? status.amountPaid / status.totalAmount : 0;
                      
                      // Find start and end positions in the dates array for preview
                      const startIndex = dates.findIndex(d => d.iso === barDrag.previewStart);
                      const endIndex = dates.findIndex(d => d.iso === barDrag.previewEnd);
                      
                      if (startIndex === -1 || endIndex === -1) return null;
                      
                      // For visual positioning, booking starts on check-in day and ends on check-out day
                      const visualStartIndex = startIndex;
                      const visualEndIndex = endIndex;
                      
                      // Calculate start and end percentages to show nights properly
                      const startPerc = 50; // 50% into the first day
                      const endPerc = 30; // 30% into the last day - creates gap between bookings
                      
                      const nightsVisible = visualEndIndex - visualStartIndex + 1;
                      const startOffset = (startPerc / 100) * 120; // 50% of 120px = 60px
                      const endOffset = (endPerc / 100) * 120; // 30% of 120px = 36px
                      
                      // Calculate width: full width minus start offset minus remaining space at end
                      const fullWidth = nightsVisible * 120;
                      const remainingEndSpace = 120 - endOffset; // 120 - 36 = 84px
                      const bookingWidth = fullWidth - startOffset - remainingEndSpace;
                      
                      return (
                        <div
                          key={`preview-${barDrag.bookingId}`}
                          className="absolute inset-y-0 z-[80] overflow-visible pointer-events-none"
                          style={{ 
                            left: `${visualStartIndex * 120 + startOffset}px`, 
                            width: `${bookingWidth}px`,
                            height: '60px'
                          }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-auto">
                            <div 
                              className={`relative z-[80] w-full rounded-md shadow-sm px-3 py-2 select-none group cursor-pointer border-2 border-dashed ${
                                barDrag.conflict 
                                  ? 'bg-red-100 border-red-400 text-red-800' 
                                  : 'bg-blue-100 border-blue-400 text-blue-800'
                              }`}
                              style={{ height: '54px' }}
                            >
                              {/* Preview content */}
                              <div className="text-[12px] truncate js-line1">
                                <span className="font-semibold text-[1.35em]">{previewBooking.guest}</span>
                                <span className="opacity-70 font-normal"> · ({price.nights} night{price.nights===1?"":"s"})</span>
                              </div>
                              <div className="text-[11px] truncate js-line2">
                                {fmtLongDate(barDrag.previewStart)} – {fmtLongDate(barDrag.previewEnd)}
                              </div>
                              {barDrag.conflict && (
                                <div className="text-[10px] text-red-600 font-medium">
                                  Conflict detected
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  
                  {/* Render drag-to-create preview */}
                  {(() => {
                    // Use only the selection state, not the ref
                    const currentSelection = selection;
                    
                    if (currentSelection && currentSelection.roomId === room.id && dragging) {
                      const startIndex = dates.findIndex(d => d.iso === currentSelection.startDate);
                      const endIndex = dates.findIndex(d => d.iso === currentSelection.endDate);
                      
                      if (startIndex === -1 || endIndex === -1) {
                        return null;
                      }
                      
                      // For visual positioning, booking starts on check-in day and ends on check-out day
                      const visualStartIndex = startIndex;
                      const visualEndIndex = endIndex;
                      
                      // Calculate start and end percentages to show nights properly
                      const startPerc = 50; // 50% into the first day
                      const endPerc = 30; // 30% into the last day - creates gap between bookings
                      
                      const nightsVisible = visualEndIndex - visualStartIndex + 1;
                      const startOffset = (startPerc / 100) * 120; // 50% of 120px = 60px
                      const endOffset = (endPerc / 100) * 120; // 30% of 120px = 36px
                      
                      // Calculate width: full width minus start offset minus remaining space at end
                      const fullWidth = nightsVisible * 120;
                      const remainingEndSpace = 120 - endOffset; // 120 - 36 = 84px
                      const bookingWidth = fullWidth - startOffset - remainingEndSpace;
                      
                      return (
                        <div
                          key={`drag-to-create-preview`}
                          className="absolute inset-y-0 z-[80] overflow-visible pointer-events-none"
                          style={{ 
                            left: `${visualStartIndex * 120 + startOffset}px`, 
                            width: `${bookingWidth}px`,
                            height: '60px'
                          }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-auto">
                            <div 
                              className="relative z-[80] w-full bg-blue-200 border-2 border-blue-400 border-dashed rounded-md shadow-sm px-3 py-2 select-none group"
                              style={{ height: '54px' }}
                            >
                              <div className="flex items-center justify-between h-full">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-blue-800 truncate">
                                    New booking
                                  </div>
                                  <div className="text-xs text-blue-600 truncate">
                                    {fmtLongDate(currentSelection.startDate)} – {fmtLongDate(currentSelection.endDate)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          </div>
          
          {/* Loading indicators */}
          {isLoading && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-white px-3 py-1 rounded-full shadow-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Loading...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Fixed Horizontal Scrollbar at Bottom of Viewport */}
        <div className="fixed bottom-0 left-0 right-0 z-[6000] bg-white border-t border-gray-300">
          <div 
            ref={bottomScrollRef}
            className="overflow-x-auto thick-scrollbar"
            onScroll={handleScroll}
            style={{ height: '16px' }}
          >
            <div className="flex min-w-max" style={{ height: '16px' }}>
              {dates.map((dateInfo, index) => (
                <div
                  key={`scrollbar-${dateInfo.iso}`}
                  className="flex-shrink-0"
                  style={{ minWidth: '120px', height: '16px' }}
                >
                  {/* Empty div to match the scrollbar width */}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Scroll position indicator */}
        <div className="border-t p-2 bg-gray-50 text-xs text-gray-500 text-center">
          Scroll Position: {Math.round(scrollPosition)}px | Total Dates: {dates.length}
        </div>
      </div>
    </div>
  );
});

const App = () => {
  // State for room type visibility
  const [typeVisible, setTypeVisible] = useState({
    powered: true,
    cabin: true,
    permanent: true
  });

  // Room management state
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomsDraft, setRoomsDraft] = useState([]);
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState(null);
  const [draggedRoomIndex, setDraggedRoomIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [typeRates, setTypeRates] = useState({
    powered: { nightly: 55, weekly: 240 },
    cabin: { nightly: 90, weekly: 450 },
    permanent: { nightly: 0, weekly: 220 }
  });

  // GST rates
  const GST_RATE_STANDARD = 0.10; // 10% GST for powered sites and cabins
  const GST_RATE_PERMANENT = 0.055; // 5.5% GST for permanent rentals

  // Power charge constants
  const ELECTRICITY_RATE = 0.30; // $/kWh

  // Memoized room inventory calculation
  const roomInventory = useMemo(() => {
    const makeSeq = (prefix, start, end) => Array.from({length: end-start+1}, (_, i) => `${prefix}${start+i}`);
    const poweredSites = [...makeSeq('G',2,4), ...makeSeq('H',1,7), ...makeSeq('I',1,7), ...makeSeq('T',1,9)];
    const cabins = Array.from({length:11}, (_,i) => `Cabin ${i+1}`);
    const permanents = [...makeSeq('A',1,3), ...makeSeq('A',5,12), ...makeSeq('B',1,5), ...makeSeq('B',9,13), ...makeSeq('C',1,8), ...makeSeq('D',5,8), ...makeSeq('E',7,11), ...makeSeq('F',1,4), 'G1'];
    
    return {
      poweredSites,
      cabins,
      permanents,
      allRooms: [
        ...poweredSites.map(id => ({id, name: id, type: 'powered', nightlyRate: 55, weeklyRate: 240, lastReading: 0})),
        ...cabins.map(id => ({id, name: id, type: 'cabin', nightlyRate: 90, weeklyRate: 450, lastReading: 0})),
        ...permanents.map(id => ({id, name: id, type: 'permanent', nightlyRate: 0, weeklyRate: 220, lastReading: 0}))
      ]
    };
  }, []);

  const [localRooms, setLocalRooms] = useState(roomInventory.allRooms);


  // Memoized filtered rooms data
  const filteredRoomsData = useMemo(() => {
    return localRooms.filter(room => {
      if (room.type === 'powered') return typeVisible.powered;
      if (room.type === 'cabin') return typeVisible.cabin;
      if (room.type === 'permanent') return typeVisible.permanent;
      return true;
    });
  }, [localRooms, typeVisible]);

  // Booking creation state
  const [selection, setSelection] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [hoverCol, setHoverCol] = useState(null);
  const [prevHoverCol, setPrevHoverCol] = useState(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  
  // Form state for booking creation
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    depositPaid: false,
    depositAmount: 0,
    depositPaymentMethod: 'cash',
    extraPaid: 0,
    paymentMethod: 'cash',
    notes: '',
    customPricing: false,
    customPricingType: 'perNight',
    customPrice: 0,
    totalPrice: 0,
    skipPhone: false,
    skipEmail: false,
    startPowerReading: 0
  });

  // Cancel confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Validation dialog state
  const [validationDialog, setValidationDialog] = useState(null);
  const [overrideNameValidation, setOverrideNameValidation] = useState(false);
  const [skipTitleCaseValidation, setSkipTitleCaseValidation] = useState(false);
  const [customPricingSetAt, setCustomPricingSetAt] = useState(null); // Track when custom pricing was set
  const [originalDateRange, setOriginalDateRange] = useState(null); // Track original date range when pricing was set

  // Booking details dialog state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(false);
  const [editingBookingData, setEditingBookingData] = useState({ 
    startDate: '', 
    endDate: '', 
    roomId: '', 
    status: 'not_checked_in',
    totalPrice: 0
  });
  const [editingCustomerData, setEditingCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    extraPaid: 0,
    paymentMethod: 'cash'
  });

  // Date editing popup state
  const [dateEditPopupOpen, setDateEditPopupOpen] = useState(false);

  // Customer info editing popup state
  const [customerEditPopupOpen, setCustomerEditPopupOpen] = useState(false);

  // Custom pricing edit popup state
  const [customPricingEditOpen, setCustomPricingEditOpen] = useState(false);
  const [editingCustomPricing, setEditingCustomPricing] = useState({
    customPricing: false,
    customPrice: 0
  });

  // Power meter reading popup state
  const [powerMeterReadingOpen, setPowerMeterReadingOpen] = useState(false);
  const [powerMeterReading, setPowerMeterReading] = useState({
    currentReading: 0,
    previousReading: 0,
    isPensioner: false
  });

  // Client management state
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [clientHistoryOpen, setClientHistoryOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState(null);
  const [showDeletedClients, setShowDeletedClients] = useState(false);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(null);
  
  // Refund warning dialog state
  const [refundWarningOpen, setRefundWarningOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundBookingId, setRefundBookingId] = useState('');
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState('');
  const [refundAcknowledged, setRefundAcknowledged] = useState(false);

  // Validation state to prevent repeated dialogs
  const [validationInProgress, setValidationInProgress] = useState(false);

  // Cancel customer edit popup and clear validation state
  const cancelCustomerEdit = () => {
    setValidationInProgress(false);
    setValidationDialog(null);
    setCustomerEditPopupOpen(false);
  };

  // Focus validation dialog when it opens
  useEffect(() => {
    if (validationDialog) {
      const dialogElement = document.querySelector('[data-validation-dialog]');
      if (dialogElement) {
        dialogElement.focus();
      }
    }
  }, [validationDialog]);

  // Register/unregister customer edit popup
  useEffect(() => {
    if (customerEditPopupOpen) {
      registerPopup('customerEdit', () => cancelCustomerEdit());
    } else {
      unregisterPopup('customerEdit');
    }
  }, [customerEditPopupOpen]);

  // Register/unregister validation dialog
  useEffect(() => {
    if (validationDialog) {
      registerPopup('validation', () => handleValidationCancel());
    } else {
      unregisterPopup('validation');
    }
  }, [validationDialog]);

  // Register/unregister booking details popup
  useEffect(() => {
    if (bookingDetailsOpen) {
      registerPopup('bookingDetails', () => setBookingDetailsOpen(false));
    } else {
      unregisterPopup('bookingDetails');
    }
  }, [bookingDetailsOpen]);

  // Register/unregister date edit popup
  useEffect(() => {
    if (dateEditPopupOpen) {
      registerPopup('dateEdit', () => setDateEditPopupOpen(false));
    } else {
      unregisterPopup('dateEdit');
    }
  }, [dateEditPopupOpen]);

  // Global escape key handler
  useEffect(() => {
    const handleGlobalEscape = (e) => {
      if (e.key === 'Escape' && popupStack.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        closeTopPopup();
      }
    };

    document.addEventListener('keydown', handleGlobalEscape);
    return () => document.removeEventListener('keydown', handleGlobalEscape);
  }, []);


  // Delete booking state
  const [deleteBookingDialog, setDeleteBookingDialog] = useState(null);
  const [deleteConfirmationDialog, setDeleteConfirmationDialog] = useState(null);

  const dragTimeoutRef = useRef(null);



  // Focus management for popups
  const [focusedPopup, setFocusedPopup] = useState(null);
  const popupStack = useRef([]);

  // Cell tooltip state
  const [cellTooltip, setCellTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Register/unregister payment dialog
  useEffect(() => {
    if (paymentDialogOpen) {
      registerPopup('payment', () => setPaymentDialogOpen(false));
    } else {
      unregisterPopup('payment');
    }
  }, [paymentDialogOpen]);

  // Register/unregister custom pricing edit popup
  useEffect(() => {
    if (customPricingEditOpen) {
      registerPopup('customPricingEdit', () => setCustomPricingEditOpen(false));
    } else {
      unregisterPopup('customPricingEdit');
    }
  }, [customPricingEditOpen]);

  // Register/unregister power meter reading popup
  useEffect(() => {
    if (powerMeterReadingOpen) {
      registerPopup('powerMeterReading', () => setPowerMeterReadingOpen(false));
    } else {
      unregisterPopup('powerMeterReading');
    }
  }, [powerMeterReadingOpen]);

  // Register/unregister client management popup
  useEffect(() => {
    if (clientsOpen) {
      registerPopup('clients', () => setClientsOpen(false));
    } else {
      unregisterPopup('clients');
    }
  }, [clientsOpen]);

  // Register/unregister client edit popup
  useEffect(() => {
    if (clientEditOpen) {
      registerPopup('clientEdit', () => setClientEditOpen(false));
    } else {
      unregisterPopup('clientEdit');
    }
  }, [clientEditOpen]);

  // Register/unregister client history popup
  useEffect(() => {
    if (clientHistoryOpen) {
      registerPopup('clientHistory', () => setClientHistoryOpen(false));
    } else {
      unregisterPopup('clientHistory');
    }
  }, [clientHistoryOpen]);

  // Focus management functions
  const registerPopup = (popupId, closeFunction) => {
    popupStack.current.push({ id: popupId, close: closeFunction });
    setFocusedPopup(popupId);
  };

  const unregisterPopup = (popupId) => {
    popupStack.current = popupStack.current.filter(popup => popup.id !== popupId);
    if (popupStack.current.length > 0) {
      const topPopup = popupStack.current[popupStack.current.length - 1];
      setFocusedPopup(topPopup.id);
    } else {
      setFocusedPopup(null);
    }
  };

  const closeTopPopup = () => {
    if (popupStack.current.length > 0) {
      const topPopup = popupStack.current[popupStack.current.length - 1];
      topPopup.close();
    }
  };

  // Validation functions
  const validateCustomerName = (name) => {
    if (!name || name.trim() === '') return false;
    const words = name.trim().split(/\s+/);
    return words.length >= 2 && words.every(word => word.length >= 2);
  };

  const validatePhone = (phone) => {
    if (!phone || phone.trim() === '') return true; // Allow empty phones
    const digits = phone.replace(/\D/g, '');
    // Be more lenient - allow partial phone numbers while typing
    return digits.length >= 8; // Reduced from 10 to 8 to be more lenient
  };

  const validateEmail = (email) => {
    if (!email || email.trim() === '') return true; // Allow empty emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Validation dialog helper
  const showValidationDialog = (type, value, onProceed) => {
    setValidationDialog({
      type,
      value,
      onProceed
    });
  };

  // Title case functions (moved here to be accessible by validateField)
  const isTitleCase = (name) => {
    if (!name || name.trim() === '') return true;
    const words = name.trim().split(/\s+/);
    return words.every(word => word.charAt(0) === word.charAt(0).toUpperCase() && word.slice(1) === word.slice(1).toLowerCase());
  };

  const toTitleCase = (name) => {
    if (!name || name.trim() === '') return name;
    return name.trim().split(/\s+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Validate date range - ensures minimum 1 night stay
  const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
      return {
        isValid: false,
        message: 'Both start and end dates are required.'
      };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        isValid: false,
        message: 'Invalid date format.'
      };
    }
    
    const nights = nightsBetween(startDate, endDate);
    
    if (nights < 1) {
      return {
        isValid: false,
        message: 'Bookings must be at least 1 night.'
      };
    }
    
    return { isValid: true };
  };

  // Immediate field validation function
  const validateField = (fieldName, value) => {
    // Allow empty fields for optional validation
    if (!value || value.trim() === '') return true;
    if (validationInProgress) return true; // Prevent repeated validation
    
    switch (fieldName) {
      case 'name':
        if (!validateCustomerName(value)) {
          setValidationInProgress(true);
          showValidationDialog('name', value, () => {
            // User chose to continue with invalid data, proceed with save
            setValidationInProgress(false);
            proceedWithImmediateSave();
          });
          return false;
        }
        if (!isTitleCase(value) && !skipTitleCaseValidation) {
          setValidationInProgress(true);
          showValidationDialog('titlecase', value, () => {
            // User chose to continue with invalid data, proceed with save
            setValidationInProgress(false);
            proceedWithImmediateSave();
          });
          return false;
        }
        break;
      case 'phone':
        if (!validatePhone(value)) {
          setValidationInProgress(true);
          showValidationDialog('phone', value, () => {
            // User chose to continue with invalid data, proceed with save
            setValidationInProgress(false);
            proceedWithImmediateSave();
          });
          return false;
        }
        break;
      case 'email':
        if (!validateEmail(value)) {
          setValidationInProgress(true);
          showValidationDialog('email', value, () => {
            // User chose to continue with invalid data, proceed with save
            setValidationInProgress(false);
            proceedWithImmediateSave();
          });
          return false;
        }
        break;
    }
    return true;
  };

  // Proceed with immediate save after validation
  const proceedWithImmediateSave = async () => {
    if (selectedBooking && editingCustomerData) {
      try {
        // Update the client record instead of the booking
        const clientId = selectedBooking.clientId;
        const updatedClient = {
          id: clientId,
          firstName: editingCustomerData.name.split(' ')[0] || '',
          lastName: editingCustomerData.name.split(' ').slice(1).join(' ') || '',
          phone: editingCustomerData.phone || '',
          email: editingCustomerData.email || ''
        };
        
        // Save client to database
        await saveClientToDatabase(updatedClient);
        
        // Update local clients state
        setClients(prev => prev.map(c => 
          c.id === clientId ? updatedClient : c
        ));
        
        // Update booking with non-client data
        const updatedBooking = {
          ...selectedBooking,
          notes: editingCustomerData.notes || '',
          extraPaid: editingCustomerData.extraPaid || 0,
          paymentMethod: editingCustomerData.paymentMethod || 'cash'
        };
        
        // Save booking to database
        await saveBookingToDatabase(updatedBooking);
        
        // Update local bookings state
        setBookings(prev => prev.map(b => 
          b.id === selectedBooking.id ? updatedBooking : b
        ));
        
        // Create updated booking with client data for display
        const updatedBookingWithClient = {
          ...updatedBooking,
          guestName: `${updatedClient.firstName} ${updatedClient.lastName}`.trim(),
          phone: updatedClient.phone,
          email: updatedClient.email
        };
        
        setSelectedBooking(updatedBookingWithClient);
        
        // Reload data from database to ensure consistency
        const freshData = await reloadDataFromDatabase();
        if (freshData) {
          // Update selectedBooking with fresh data
          const updatedBookingFromDB = freshData.bookings.find(b => b.id === selectedBooking.id);
          if (updatedBookingFromDB) {
            setSelectedBooking(updatedBookingFromDB);
          }
        }
        
      } catch (error) {
        console.error('Error saving customer changes:', error);
        toast.error('Failed to save customer changes. Please try again.');
      }
    }
  };

  // Validate all fields before action
  const validateAllFields = (onSuccess) => {
    if (validationInProgress) return false; // Prevent repeated validation
    
    const validationErrors = [];
    
    // Validate name
    if (editingCustomerData.name && editingCustomerData.name.trim() && !validateCustomerName(editingCustomerData.name)) {
      validationErrors.push({ field: 'name', value: editingCustomerData.name, type: 'name' });
    }
    
    // Validate phone
    if (editingCustomerData.phone && editingCustomerData.phone.trim() && !validatePhone(editingCustomerData.phone)) {
      validationErrors.push({ field: 'phone', value: editingCustomerData.phone, type: 'phone' });
    }
    
    // Validate email
    if (editingCustomerData.email && editingCustomerData.email.trim() && !validateEmail(editingCustomerData.email)) {
      validationErrors.push({ field: 'email', value: editingCustomerData.email, type: 'email' });
    }


    if (validationErrors.length > 0) {
      const firstError = validationErrors[0];
      setValidationInProgress(true);
      showValidationDialog(firstError.type, firstError.value, () => {
        // User chose to continue with invalid data, proceed with action
        setValidationInProgress(false);
        proceedWithImmediateSave();
        onSuccess();
      });
      return false;
    }
    
    // No validation errors, proceed with action
    proceedWithImmediateSave();
    onSuccess();
    return true;
  };

  // Open customer edit popup
  const openCustomerEditPopup = () => {
    // Initialize editingCustomerData with current booking data (from joined query)
    setEditingCustomerData({
      name: selectedBooking.guestName || '',
      phone: selectedBooking.phone || '',
      email: selectedBooking.email || '',
      notes: selectedBooking.notes || '',
      extraPaid: selectedBooking.extraPaid || 0,
      paymentMethod: selectedBooking.paymentMethod || 'cash'
    });
    setCustomerEditPopupOpen(true);
  };

  // Open booking edit popup
  const openDateEditPopup = () => {
    // Initialize editingBookingDates with current booking data
    setEditingBookingDates({
      startDate: selectedBooking.start,
      endDate: selectedBooking.end,
      roomId: selectedBooking.roomId,
      status: selectedBooking.checkedOut ? 'checked_out' : 
              selectedBooking.checkedIn ? 'checked_in' : 'not_checked_in'
    });
    setDateEditPopupOpen(true);
  };

  // Open custom pricing edit popup
  const openCustomPricingEditPopup = () => {
    // Initialize editingCustomPricing with current booking custom pricing
    setEditingCustomPricing({
      customPricing: selectedBooking.customPricing || false,
      customPrice: selectedBooking.customPrice || 0
    });
    setCustomPricingEditOpen(true);
  };

  // Save custom pricing changes
  const saveCustomPricingChanges = () => {
    if (!selectedBooking) return;

    // Update the booking with new custom pricing
    setBookings(prevBookings => 
      prevBookings.map(booking => 
        booking.id === selectedBooking.id 
          ? { 
              ...booking, 
              customPricing: editingCustomPricing.customPricing,
              customPrice: editingCustomPricing.customPrice,
              // Recalculate total amount if custom pricing is disabled
              totalPrice: editingCustomPricing.customPricing 
                ? editingCustomPricing.customPrice 
                : calculateBookingTotal(booking)
            }
          : booking
      )
    );

    // Update selectedBooking to reflect changes
    setSelectedBooking(prev => ({
      ...prev,
      customPricing: editingCustomPricing.customPricing,
      customPrice: editingCustomPricing.customPrice,
      totalPrice: editingCustomPricing.customPricing 
        ? editingCustomPricing.customPrice 
        : calculateBookingTotal(prev)
    }));

    setCustomPricingEditOpen(false);
  };

  // Open power meter reading popup
  const openPowerMeterReadingPopup = () => {
    // Get the room for this booking to find the last reading
    const room = localRooms.find(r => r.id === selectedBooking.roomId);
    const lastReading = room ? room.lastReading : 0;
    
    setPowerMeterReading({
      currentReading: 0,
      previousReading: lastReading,
      isPensioner: selectedBooking.pensioner || false
    });
    setPowerMeterReadingOpen(true);
  };

  // Save power meter reading
  const savePowerMeterReading = () => {
    if (!selectedBooking) {
      return;
    }

    // Validate inputs
    if (!powerMeterReading.currentReading || powerMeterReading.currentReading < 0) {
      alert('Please enter a valid current reading');
      return;
    }

    if (powerMeterReading.currentReading < powerMeterReading.previousReading) {
      alert('Current reading cannot be less than previous reading');
      return;
    }

    const electricityUsed = Math.max(0, powerMeterReading.currentReading - powerMeterReading.previousReading);
    let electricityCost = electricityUsed * ELECTRICITY_RATE;
    
    // Apply 10% pensioner discount if applicable
    if (powerMeterReading.isPensioner) {
      electricityCost = electricityCost * 0.9; // 10% discount
    }

    // Calculate new total amount (remove old electricity cost and add new one)
    const oldElectricityCost = selectedBooking.electricityCost || 0;
    const newTotalAmount = (selectedBooking.totalPrice || 0) - oldElectricityCost + electricityCost;

    // Update the booking with electricity costs
    setBookings(prevBookings => 
      prevBookings.map(booking => 
        booking.id === selectedBooking.id 
          ? { 
              ...booking, 
              electricityUsed: electricityUsed, 
              electricityCost: electricityCost, 
              pensioner: powerMeterReading.isPensioner, 
              totalPrice: newTotalAmount 
            }
          : booking
      )
    );

    // Update the room's last reading
    setLocalRooms(prevRooms => 
      prevRooms.map(room => 
        room.id === selectedBooking.roomId 
          ? { ...room, lastReading: powerMeterReading.currentReading }
          : room
      )
    );


    // Update selectedBooking to reflect changes
    setSelectedBooking(prev => ({
      ...prev,
      electricityUsed: electricityUsed,
      electricityCost: electricityCost,
      pensioner: powerMeterReading.isPensioner,
      totalPrice: newTotalAmount
    }));


    // Close the popup
    setPowerMeterReadingOpen(false);
  };

  // Client management functions
  const findOrCreateClient = (firstName, lastName, phone, email) => {
    // First, try to find existing client by phone or email
    let existingClient = clients.find(client => 
      client.phone === phone || client.email === email
    );
    
    if (existingClient) {
      // Update existing client with new booking info
      const updatedClient = {
        ...existingClient, 
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        lastBookingDate: new Date().toISOString().split('T')[0],
        totalBookings: (existingClient.totalBookings || 0) + 1
      };
      
      setClients(prevClients => 
        prevClients.map(client => 
          client.id === existingClient.id ? updatedClient : client
        )
      );
      
      // Save updated client to database
      saveClientToDatabase(updatedClient);
      
      return existingClient.id;
    }
    
    // Create new client
    const newClient = {
      id: `client_${Date.now()}`,
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      email: email,
      createdDate: new Date().toISOString().split('T')[0],
      lastBookingDate: new Date().toISOString().split('T')[0],
      totalBookings: 1,
      isDeleted: false,
      deletedDate: null,
      bookingHistory: []
    };
    
    setClients(prevClients => [...prevClients, newClient]);
    
    // Save client to database
    saveClientToDatabase(newClient);
    
    return newClient.id;
  };

  // Helper function to normalize phone numbers for comparison
  const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    // Remove all non-digit characters (spaces, dashes, parentheses, etc.)
    return phone.replace(/\D/g, '');
  };

  const searchClients = (query) => {
    if (query.length < 1) {
      setClientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const matches = clients.filter(client => {
      if (client.isDeleted) return false; // Exclude deleted clients
      
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const phone = client.phone || '';
      const email = client.email || '';
      
      // Normalize phone numbers for comparison
      const normalizedPhone = normalizePhoneNumber(phone);
      const normalizedQuery = normalizePhoneNumber(query);
      
      return fullName.includes(query.toLowerCase()) || 
             phone.includes(query) || 
             normalizedPhone.includes(normalizedQuery) ||
             email.toLowerCase().includes(query.toLowerCase());
    }).sort((a, b) => {
      // Sort by relevance: exact name matches first, then by last booking date
      const aName = `${a.firstName} ${a.lastName}`.toLowerCase();
      const bName = `${b.firstName} ${b.lastName}`.toLowerCase();
      const queryLower = query.toLowerCase();
      
      if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
      if (!aName.startsWith(queryLower) && bName.startsWith(queryLower)) return 1;
      
      return new Date(b.lastBookingDate) - new Date(a.lastBookingDate);
    });
    
    setClientSuggestions(matches.slice(0, 8)); // Increased to 8 suggestions
    setShowSuggestions(matches.length > 0);
  };

  const selectClientSuggestion = (client) => {
    // Update the form with the client's data
    const clientName = `${client.firstName} ${client.lastName}`.trim();
    
    setForm(prev => ({
      ...prev,
      name: clientName,
      phone: client.phone || '',
      email: client.email || ''
    }));
    
    setClientSuggestions([]);
    setShowSuggestions(false);
  };

  const openClientEdit = (client) => {
    setEditingClient({ ...client });
    setClientEditOpen(true);
  };

  const saveClientEdit = () => {
    if (!editingClient) return;
    
    // Validate client data
    if (!validateCustomerName(`${editingClient.firstName} ${editingClient.lastName}`)) {
      showValidationDialog('name', `${editingClient.firstName} ${editingClient.lastName}`, () => {
        // Continue with save after validation
        performClientSave();
      });
      return;
    }
    
    if (editingClient.phone && !validatePhone(editingClient.phone)) {
      showValidationDialog('phone', editingClient.phone, () => {
        performClientSave();
      });
      return;
    }
    
    if (editingClient.email && !validateEmail(editingClient.email)) {
      showValidationDialog('email', editingClient.email, () => {
        performClientSave();
      });
      return;
    }
    
    performClientSave();
  };

  const performClientSave = () => {
    if (!editingClient) return;
    
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === editingClient.id ? editingClient : client
      )
    );
    
    // Update any bookings linked to this client
    setBookings(prevBookings => 
      prevBookings.map(booking => 
        booking.clientId === editingClient.id 
          ? {
              ...booking,
              firstName: editingClient.firstName,
              lastName: editingClient.lastName,
              phone: editingClient.phone,
              email: editingClient.email
            }
          : booking
      )
    );
    
    setClientEditOpen(false);
    setEditingClient(null);
  };

  const deleteClient = (clientId) => {
    setClients(prevClients => prevClients.filter(client => client.id !== clientId));
    setClientEditOpen(false);
    setEditingClient(null);
  };

  // Soft delete client (preserves booking history)
  const softDeleteClient = (clientId) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId 
          ? { 
              ...client, 
              isDeleted: true, 
              deletedDate: new Date().toISOString().split('T')[0] 
            }
          : client
      )
    );
    setClientEditOpen(false);
    setEditingClient(null);
  };

  // Restore soft-deleted client
  const restoreClient = (clientId) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId 
          ? { 
              ...client, 
              isDeleted: false, 
              deletedDate: null 
            }
          : client
      )
    );
  };

  // Add booking to client history
  const addBookingToClientHistory = (clientId, bookingId, bookingData) => {
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId 
          ? { 
              ...client, 
              bookingHistory: [
                ...(client.bookingHistory || []),
                {
                  bookingId: bookingId,
                  roomId: bookingData.roomId,
                  startDate: bookingData.start,
                  endDate: bookingData.end,
                  totalAmount: bookingData.totalPrice,
                  status: bookingData.checkedIn ? 'checked-in' : 'upcoming',
                  bookingDate: new Date().toISOString().split('T')[0]
                }
              ]
            }
          : client
      )
    );
  };

  // Get client booking history
  const getClientBookingHistory = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.bookingHistory || [] : [];
  };

  // Open client history dialog
  const openClientHistory = (client) => {
    setSelectedClientForHistory(client);
    setClientHistoryOpen(true);
  };

  // Calculate nights between dates
  const calculateNights = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Calculate total booking amount based on room rates
  const calculateBookingTotal = (booking) => {
    if (!booking || !booking.startDate || !booking.endDate) return 0;
    
    const nights = nightsBetween(booking.startDate, booking.endDate);
    const room = localRooms.find(r => r.id === booking.roomId);
    
    if (!room) return 0;
    
    // Calculate based on weekly rates if applicable
    const weeks = Math.floor(nights / 7);
    const remainingNights = nights % 7;
    
    let total = 0;
    if (weeks > 0) {
      total += weeks * room.weeklyRate;
    }
    if (remainingNights > 0) {
      total += remainingNights * room.nightlyRate;
    }
    
    return total;
  };

  // Check if booking has custom pricing
  const hasCustomPricing = () => {
    return selectedBooking.customPricing && selectedBooking.customPrice > 0;
  };

  // Initialize save status
  useEffect(() => {
  }, []);


  // Existing booking conflict dialog state
  const [existingBookingDialog, setExistingBookingDialog] = useState(null);

  // Phone formatting functions (from full app)
  const fmtPhoneAUInput = (raw) => {
    if (raw == null) return '';
    const s = String(raw);
    const digits = s.replace(/\D/g, '');
    if (digits.length > 10) return digits; // remove all spaces for long numbers
    if (digits.startsWith('04')) {
      const a = digits.slice(0,2); // 04
      const b = digits.slice(2,4);
      const c = digits.slice(4,7);
      const d = digits.slice(7,10);
      let out = a;
      if (b) out += b;
      if (c) out += ` ${c}`;
      if (d) out += ` ${d}`;
      return out;
    }
    if (digits[0] === '0' && digits[1] && digits[1] !== '4') {
      const a = digits.slice(0,2); // 0x
      const b = digits.slice(2,6);
      const c = digits.slice(6,10);
      let out = a;
      if (b) out += ` ${b}`;
      if (c) out += ` ${c}`;
      return out;
    }
    return s;
  };

  // Validation functions (from full app)
  const limitToTwoDecimals = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return Math.round(num * 100) / 100;
  };

  // Comprehensive booking validation - ensures all bookings have valid date ranges
  const validateBooking = (booking) => {
    if (!booking || !booking.startDate || !booking.endDate) {
      return {
        isValid: false,
        message: 'Booking must have both start and end dates.'
      };
    }
    
    const validation = validateDateRange(booking.startDate, booking.endDate);
    if (!validation.isValid) {
      return validation;
    }
    
    return { isValid: true };
  };

  // Validate all bookings in the system
  const validateAllBookings = () => {
    const invalidBookings = [];
    
    bookings.forEach(booking => {
      const validation = validateBooking(booking);
      if (!validation.isValid) {
        invalidBookings.push({
          id: booking.id,
          guest: booking.guestName || booking.guestName || 'Unknown',
          message: validation.message
        });
      }
    });
    
    if (invalidBookings.length > 0) {
      console.error('Invalid bookings found:', invalidBookings);
      return {
        isValid: false,
        invalidBookings
      };
    }
    
    return { isValid: true };
  };

  const handleValidationProceed = () => {
    if (validationDialog?.onProceed) {
      validationDialog.onProceed();
    }
    setValidationDialog(null);
    setOverrideNameValidation(false);
    setValidationInProgress(false); // Reset validation in progress flag
  };

  const handleValidationCancel = () => {
    setValidationDialog(null);
    setOverrideNameValidation(false);
    setValidationInProgress(false); // Reset validation in progress flag
  };

  // Handle title case correction
  const handleTitleCaseCorrection = () => {
    if (validationDialog?.type === 'titlecase') {
      const correctedName = toTitleCase(validationDialog.value);
      
        // Update the appropriate form based on context
        if (editingCustomerData) {
          setEditingCustomerData(prev => ({ ...prev, name: correctedName }));
        } else if (form) {
          setForm(prev => ({ ...prev, name: correctedName }));
        }
    }
    handleValidationProceed();
  };

  // Booking state management
  const [bookings, setBookings] = useState([]);






  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  // Grid metrics for bar drag (from full app)
  const gridMetricsRef = useRef({ cellW: 120, rowH: 60, left: 0, top: 0 });
  
  // Bar drag state (from full app)
  const [barDrag, setBarDrag] = useState(null);
  
  // Drag-to-create state (using main app logic)
  const [dragging, setDragging] = useState(false);
  const dragRoomRef = useRef(null);
  const dragStartRef = useRef(null);
  const dragCurrentEndRef = useRef(null); // Track current end date
  const dragLastColumnRef = useRef(null); // Track last column to detect border crossing
  const dragFirstBorderCrossedRef = useRef(false); // Track if first border crossing has been ignored
  const [justFinishedDrag, setJustFinishedDrag] = useState(false);
  const currentSelectionRef = useRef(null); // Track current selection for immediate updates
  
  const infiniteCalendarRef = useRef(null);

  // Grid measurement function (from full app)
  const measureGridMetrics = () => {
    const gridElement = document.querySelector('[data-grid-firstcell="1"]');
    if (gridElement) {
      const rect = gridElement.getBoundingClientRect();
      gridMetricsRef.current = {
        cellW: 120, // Fixed cell width
        rowH: 60,   // Fixed row height
        left: rect.left,
        top: rect.top
      };
    }
  };

  // Bar drag function (from full app)
  const startBarDrag = (b, type, e, dates) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Ensure grid metrics are measured
    measureGridMetrics();
    const m = gridMetricsRef.current;
    
    // Safety check for grid metrics
    if (!m || !m.cellW || !m.rowH) {
      console.error('Grid metrics not available for bar drag');
      return;
    }
    
    const rawColDown = ((e.clientX - m.left) / m.cellW);
    const startIndex = dates.findIndex(d => d.iso === b.start);
    const offsetCols = rawColDown - (startIndex >= 0 ? startIndex : 0);
    
    setBarDrag({
      bookingId: b.id,
      type,
      originStart: b.start,
      originEnd: b.end,
      originRoomId: b.roomId,
      previewStart: b.start,
      previewEnd: b.end,
      previewRoomId: b.roomId,
      conflict: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      activated: false,
      offsetCols
    });
  };

  // Helper functions from main app
  const normalizeRange = (a, b) => { 
    const da = new Date(a); 
    da.setHours(0, 0, 0, 0);
    const db = new Date(b); 
    db.setHours(0, 0, 0, 0);
    // Return [earlier_date, later_date] for inclusive booking
    return da <= db ? [da, db] : [db, da]; 
  };
  
  // For drag selection display (inclusive dates)
  const normalizeSelectionRange = (a, b) => {
    const da = new Date(a); 
    da.setHours(0, 0, 0, 0);
    const db = new Date(b); 
    db.setHours(0, 0, 0, 0);
    return da <= db ? [da, db] : [db, da]; 
  };
  
  // Drag-to-create functions (using main app logic)
  const handleMouseDown = (roomId, dISO, e) => {
    if (barDrag) return;
    
    // Check if there's a booking starting on this date - show conflict warning
    const bookingsStartingHere = bookings.filter(b => b.roomId === roomId && b.start === dISO);
    if (bookingsStartingHere.length > 0) {
      // For now, just continue - we can add conflict dialog later
      return;
    }
    
    // Clear any existing tooltip when starting drag
    setCellTooltip(null);
    
    // Set up drag state without pre-setting end date
    setDragging(true);
    dragRoomRef.current = roomId;
    dragStartRef.current = dISO;
    // Don't set initial selection - let drag logic determine the range
  };


  // Mouse up effect handler (from main app)
  useEffect(() => {
    const up = () => {
      if (dragging) {
        setDragging(false);
        
        // Check for conflicts before opening create dialog for drag-created selection
        if (dragRoomRef.current) {
          const roomId = dragRoomRef.current;
          let startDate, endDate;
          
          if (selection && selection.startDate && selection.endDate) {
            // Use existing selection from drag
            startDate = selection.startDate;
            endDate = selection.endDate;
          } else {
            // No drag occurred - create default 1-night selection
            startDate = dragStartRef.current;
            endDate = dateKey(addDays(new Date(dragStartRef.current), 1));
            // Set the selection for the create dialog
            setSelection({ roomId, startDate, endDate });
          }
          
          const conflictingBookings = bookings.filter(x => x.roomId === roomId && !(endDate <= x.start || startDate >= x.end));
          if (conflictingBookings.length > 0) {
            // For now, just continue - we can add conflict dialog later
          }
        }
        
        // Set flag to prevent click handler from firing
        setJustFinishedDrag(true);
        
        // Clear the flag after a short delay
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
        dragTimeoutRef.current = setTimeout(() => {
          setJustFinishedDrag(false);
          dragTimeoutRef.current = null;
        }, 100);
        
        setCreateOpen(true);
        setWizardStep(0);
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [dragging, selection, bookings]);

  const handleResetToToday = () => {
    if (infiniteCalendarRef.current && infiniteCalendarRef.current.resetToTodayRef.current) {
      infiniteCalendarRef.current.resetToTodayRef.current();
    }
  };

  const importClick = () => {
    handleImportClick();
  };

  // Import/Export functions
  const importInputRef = useRef(null);
  
  const exportData = () => { 
    const data = { 
      version: 6, 
      exportedAt: new Date().toISOString(), 
      rooms: localRooms, 
      bookings: bookings
    }; 
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `holiday-park-backup-${new Date().toISOString().slice(0, 10)}.json`; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
    URL.revokeObjectURL(url); 
    toast.success('Backup downloaded'); 
  };

  // CSV Export Functions
  const arrayToCSV = (data, headers) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
      }).join(','))
    ].join('\n');
    return csvContent;
  };

  const exportToCSV = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Bookings CSV
    const bookingsCSV = arrayToCSV(bookings, [
      'id', 'roomId', 'clientId', 'start', 'end', 'status', 'paymentMethod', 'paid', 
      'nightlyRate', 'notes', 'depositAmount', 'depositPaid', 'depositPaymentMethod',
      'depositDue', 'checkedIn', 'checkedOut', 'extraPaid', 'customPricing', 
      'customWeekly', 'pensioner', 'elecDisabled', 'electricityBaseline', 'paymentHistory'
    ]);
    const bookingsBlob = new Blob([bookingsCSV], { type: 'text/csv' });
    const bookingsUrl = URL.createObjectURL(bookingsBlob);
    const bookingsLink = document.createElement('a');
    bookingsLink.href = bookingsUrl;
    bookingsLink.download = `bookings-${timestamp}.csv`;
    document.body.appendChild(bookingsLink);
    bookingsLink.click();
    document.body.removeChild(bookingsLink);
    URL.revokeObjectURL(bookingsUrl);

    // Rooms CSV
    const roomsCSV = arrayToCSV(localRooms, [
      'id', 'name', 'type', 'nightlyRate', 'weeklyRate', 'lastReading'
    ]);
    const roomsBlob = new Blob([roomsCSV], { type: 'text/csv' });
    const roomsUrl = URL.createObjectURL(roomsBlob);
    const roomsLink = document.createElement('a');
    roomsLink.href = roomsUrl;
    roomsLink.download = `rooms-${timestamp}.csv`;
    document.body.appendChild(roomsLink);
    roomsLink.click();
    document.body.removeChild(roomsLink);
    URL.revokeObjectURL(roomsUrl);

    toast.success('CSV files downloaded');
  };

  // Invoice generation and printing
  const printInvoice = (booking) => {
    if (!booking) return;
    
    // Calculate GST amounts with correct rates
    const isPermanent = booking.roomId && booking.roomId.toLowerCase().includes('permanent');
    const gstRate = isPermanent ? GST_RATE_PERMANENT : GST_RATE_STANDARD;
    
    const accommodationAmount = booking.totalPrice || 0;
    const powerAmount = booking.electricityCost || 0;
    const totalAmount = accommodationAmount + powerAmount;
    const gstAmount = accommodationAmount / (1 + gstRate) * gstRate; // GST only on accommodation
    const amountExcludingGST = accommodationAmount - gstAmount;
    
    // Calculate payments made
    const depositAmount = booking.depositPaid ? (booking.depositAmount || 0) : 0;
    const extraPaid = booking.extraPaid || 0;
    const totalPaid = depositAmount + extraPaid;
    const balanceOwing = totalAmount - totalPaid;
    
    // Generate unique invoice number
    const invoiceNumber = `INV-${booking.id}-${Date.now()}`;
    const invoiceDate = new Date().toLocaleDateString('en-AU');
    
    // Create HTML content for invoice
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Tax Invoice - ${invoiceNumber}</title>
        <style>
          @page {
            size: A5 landscape;
            margin: 0;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 148mm;
            font-size: 11px;
            background: white;
          }
          
          /* Header Section */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 5mm;
            border-bottom: 1px solid #2563eb;
            padding-bottom: 4mm;
          }
          .business-info {
            text-align: left;
          }
          .business-name {
            font-size: 16px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 2mm;
          }
          .business-details {
            font-size: 10px;
            line-height: 1.3;
            color: #374151;
          }
          .business-details p {
            margin: 0.5px 0;
          }
          
          /* Invoice Info */
          .invoice-info {
            text-align: right;
          }
          .invoice-number {
            font-size: 12px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 1mm;
          }
          .invoice-date {
            font-size: 10px;
            color: #6b7280;
          }
          
          /* Main Content Layout */
          .main-content {
            display: flex;
            gap: 8mm;
            margin-top: 4mm;
          }
          .left-column {
            flex: 1;
          }
          .right-column {
            flex: 1;
          }
          
          /* Customer Section */
          .customer-section {
            margin-bottom: 4mm;
            background: #f1f5f9;
            padding: 3mm;
            border-radius: 3px;
            border-left: 3px solid #2563eb;
          }
          .section-title {
            font-size: 10px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 2mm;
            text-transform: uppercase;
          }
          .customer-name {
            font-size: 13px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 2mm;
          }
          .booking-details {
            font-size: 10px;
            color: #4b5563;
            line-height: 1.3;
          }
          
          /* Cost Breakdown */
          .cost-breakdown {
            margin-bottom: 4mm;
          }
          .cost-item {
            display: flex;
            justify-content: space-between;
            padding: 2mm 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 10px;
          }
          .cost-item.total {
            font-weight: bold;
            font-size: 12px;
            color: #1f2937;
            border-top: 2px solid #2563eb;
            border-bottom: 2px solid #2563eb;
            margin-top: 2mm;
            padding: 3mm 0;
          }
          .cost-label {
            color: #6b7280;
          }
          .cost-value {
            font-weight: bold;
            color: #1f2937;
          }
          
          /* Payments Section */
          .payments-section {
            margin-bottom: 4mm;
          }
          .payment-item {
            display: flex;
            justify-content: space-between;
            padding: 2mm 0;
            font-size: 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          .payment-label {
            color: #6b7280;
          }
          .payment-value {
            font-weight: bold;
            color: #059669;
          }
          
          /* Balance Section */
          .balance-section {
            background: #fef3c7;
            padding: 4mm;
            border-radius: 3px;
            border-left: 3px solid #f59e0b;
            text-align: center;
          }
          .balance-label {
            font-size: 10px;
            color: #92400e;
            margin-bottom: 2mm;
          }
          .balance-amount {
            font-size: 14px;
            font-weight: bold;
            color: #92400e;
          }
          .balance-zero {
            color: #059669;
          }
          
          @media print {
            body { 
              margin: 0; 
              padding: 0; 
              width: 210mm;
              height: 148mm;
            }
            .invoice-container { 
              width: 100%; 
              height: 100%;
              padding: 6mm;
              box-sizing: border-box;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="business-info">
              <div class="business-name">Holiday Park Booking System</div>
              <div class="business-details">
                <p>61 Ocean Street Torquay QLD 4655</p>
                <p>ABN 71 205 881 488</p>
                <p>Ron / Gaye Ford</p>
                <p>Ph (07) 4125 1105</p>
              </div>
            </div>
            <div class="invoice-info">
              <div class="invoice-number">Tax Invoice: ${invoiceNumber}</div>
              <div class="invoice-date">Date: ${new Date().toLocaleDateString('en-AU')}</div>
            </div>
          </div>
          
          <!-- Main Content -->
          <div class="main-content">
            <!-- Left Column -->
            <div class="left-column">
              <!-- Customer Section -->
              <div class="customer-section">
                <div class="section-title">Customer Details</div>
                <div class="customer-name">${booking.guestName}</div>
                <div class="booking-details">
                  <p><strong>Booking:</strong> ${booking.startDate} to ${booking.endDate}</p>
                  <p><strong>Site:</strong> ${booking.roomId}</p>
                </div>
              </div>
              
              <!-- Cost Breakdown -->
              <div class="cost-breakdown">
                <div class="section-title">Cost Breakdown</div>
                <div class="cost-item">
                  <span class="cost-label">Accommodation (Ex GST)</span>
                  <span class="cost-value">$${amountExcludingGST.toFixed(2)}</span>
                </div>
                ${booking.electricityCost && booking.electricityCost > 0 ? `
                  <div class="cost-item">
                    <span class="cost-label">Power (${booking.electricityUsed || 0} kWh @ $${ELECTRICITY_RATE}/kWh)</span>
                    <span class="cost-value">$${(booking.electricityCost || 0).toFixed(2)}</span>
                  </div>
                ` : ''}
                <div class="cost-item">
                  <span class="cost-label">Total (Ex GST)</span>
                  <span class="cost-value">$${(amountExcludingGST + (booking.electricityCost || 0)).toFixed(2)}</span>
                </div>
                <div class="cost-item">
                  <span class="cost-label">GST (${(gstRate * 100).toFixed(1)}%)</span>
                  <span class="cost-value">$${gstAmount.toFixed(2)}</span>
                </div>
                <div class="cost-item total">
                  <span class="cost-label">Total incl GST</span>
                  <span class="cost-value">$${(booking.totalPrice + (booking.electricityCost || 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <!-- Right Column -->
            <div class="right-column">
              <!-- Payments Section -->
              <div class="payments-section">
                <div class="section-title">Payments Received</div>
                ${depositAmount > 0 ? `
                  <div class="payment-item">
                    <span class="payment-label">Deposit (${booking.paymentMethod || 'eftpos'})</span>
                    <span class="payment-value">$${depositAmount.toFixed(2)}</span>
                  </div>
                ` : ''}
                ${extraPaid > 0 ? `
                  <div class="payment-item">
                    <span class="payment-label">Additional Payment (${booking.paymentMethod || 'eftpos'})</span>
                    <span class="payment-value">$${extraPaid.toFixed(2)}</span>
                  </div>
                ` : ''}
                ${totalPaid === 0 ? `
                  <div class="payment-item">
                    <span class="payment-label">No payments received</span>
                    <span class="payment-value">$0.00</span>
                  </div>
                ` : ''}
                <div class="payment-item">
                  <span class="payment-label"><strong>Total Paid</strong></span>
                  <span class="payment-value"><strong>$${totalPaid.toFixed(2)}</strong></span>
                </div>
              </div>
              
              <!-- Balance Section -->
              <div class="balance-section">
                <div class="balance-label">Balance Owing</div>
                <div class="balance-amount ${balanceOwing === 0 ? 'balance-zero' : ''}">
                  ${balanceOwing === 0 ? 'PAID IN FULL' : `$${balanceOwing.toFixed(2)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const importData = async (file) => { 
    try { 
      const text = await file.text(); 
      const json = JSON.parse(text); 
      if (!json.rooms || !json.bookings) { 
        toast.error('Invalid backup file'); 
        return; 
      } 
      setLocalRooms(json.rooms); 
      setBookings(json.bookings); 
      toast.success('Backup imported'); 
    } catch (e) { 
      toast.error('Failed to import backup'); 
    } 
  };

  const handleImportClick = () => importInputRef.current?.click();

  // Auto-backup functionality





  // Room management functions
  useEffect(() => { 
    if (roomsOpen) setRoomsDraft(localRooms.map(r => ({ ...r }))); 
  }, [roomsOpen, localRooms]);

  // Set default payment method when paymentMethods are loaded
  useEffect(() => {
    if (paymentMethods.length > 0 && !form.depositPaymentMethod) {
      const defaultMethod = paymentMethods.find(method => method.isDefault) || paymentMethods[0];
      setForm(prev => ({ 
        ...prev, 
        depositPaymentMethod: defaultMethod.id,
        paymentMethod: defaultMethod.id
      }));
    }
  }, [paymentMethods]);

  // Payment Methods functions
  const addPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) {
      toast.error('Please enter a payment method name');
      return;
    }
    
    const methodName = newPaymentMethodName.trim();
    const methodId = methodName.toLowerCase().replace(/\s+/g, '_');
    
    // Check if method already exists
    if (paymentMethods.some(method => method.id === methodId)) {
      toast.error('Payment method already exists');
      return;
    }
    
    try {
      const newMethod = {
        id: methodId,
        name: methodName,
        isDefault: false,
        isActive: true
      };
      
      await apiService.createPaymentMethod(newMethod);
      setPaymentMethods(prev => [...prev, newMethod]);
      setNewPaymentMethodName('');
      toast.success('Payment method added successfully');
    } catch (error) {
      console.error('Error adding payment method:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to add payment method: ${errorMessage}`);
    }
  };

  const removePaymentMethod = async (methodId) => {
    // Prevent removing Cash method
    if (methodId === 'cash') {
      toast.error('Cannot remove the default Cash payment method');
      return;
    }
    
    try {
      await apiService.deletePaymentMethod(methodId);
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
      toast.success('Payment method removed successfully');
    } catch (error) {
      console.error('Error removing payment method:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to remove payment method: ${errorMessage}`);
    }
  };

  const updatePaymentMethod = async (methodId, newName) => {
    if (!newName.trim()) {
      toast.error('Please enter a payment method name');
      return;
    }
    
    // Don't allow renaming Cash method
    if (methodId === 'cash') {
      toast.error('Cannot rename the default Cash payment method');
      return;
    }
    
    try {
      await apiService.updatePaymentMethod(methodId, { name: newName.trim() });
      setPaymentMethods(prev => prev.map(method => 
        method.id === methodId 
          ? { ...method, name: newName.trim() }
          : method
      ));
      setEditingPaymentMethod(null);
      toast.success('Payment method updated successfully');
    } catch (error) {
      console.error('Error updating payment method:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to update payment method: ${errorMessage}`);
    }
  };

  // Data loading state
  const [dataLoadingError, setDataLoadingError] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Load data from database on component mount
  // Load data from database function
  const loadDataFromDatabase = async () => {
    try {
      setDataLoading(true);
      const data = await apiService.getAllData();
      
      if (data.bookings && data.bookings.length > 0) {
        // Set bookings without loading payment data - payments will be loaded on-demand
        // Ensure each booking has a payments property initialized
        const bookingsWithPayments = data.bookings.map(booking => ({
          ...booking,
          payments: booking.payments || []
        }));
        setBookings(bookingsWithPayments);
        
        // If a booking is currently selected, update it with the latest data
        if (selectedBooking) {
          const updatedSelectedBooking = bookingsWithPayments.find(b => b.id === selectedBooking.id);
          if (updatedSelectedBooking) {
            setSelectedBooking(updatedSelectedBooking);
          }
        }
      }
      
      if (data.rooms && data.rooms.length > 0) {
        setLocalRooms(data.rooms);
      }
      
      if (data.clients && data.clients.length > 0) {
        setClients(data.clients);
      }
      
      if (data.paymentMethods && data.paymentMethods.length > 0) {
        setPaymentMethods(data.paymentMethods);
      }
      
      setDataLoadingError(null);
      setDataLoading(false);
    } catch (error) {
      console.error('Error loading data from database:', error);
      const errorMessage = apiService.getErrorMessage(error);
      setDataLoadingError(errorMessage);
      setDataLoading(false);
      toast.error(`Failed to load data: ${errorMessage}`);
    }
  };

  useEffect(() => {
    // Load data immediately on mount
    loadDataFromDatabase();
  }, []); // Run only once on mount

  const addRoomDraft = () => {
    setRoomsDraft(prev => {
      // Find the next available room number for each type
      const typeCounts = { powered: 0, cabin: 0, permanent: 0 };
      prev.forEach(room => {
        if (typeCounts.hasOwnProperty(room.type)) {
          typeCounts[room.type]++;
        }
      });
      
      // Generate a smart room ID based on type
      const t = 'powered'; // Default type
      const nextNumber = typeCounts[t] + 1;
      const id = `${t.charAt(0).toUpperCase()}${nextNumber}`;
      
      return [
        ...prev,
        { 
          id, 
          name: id, 
          type: t, 
          nightlyRate: typeRates[t]?.nightly || 0, 
          weeklyRate: typeRates[t]?.weekly || 0, 
          lastReading: 0 
        },
      ];
    });
  };

  const updateRoomDraft = (idx, patch) => setRoomsDraft(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeRoomDraft = (idx) => setRoomsDraft(prev => prev.filter((_, i) => i !== idx));

  const moveRoomUp = (idx) => {
    if (idx > 0) {
      setRoomsDraft(prev => {
        const newRooms = [...prev];
        [newRooms[idx-1], newRooms[idx]] = [newRooms[idx], newRooms[idx-1]];
        return newRooms;
      });
    }
  };

  const moveRoomDown = (idx) => {
    setRoomsDraft(prev => {
      if (idx < prev.length - 1) {
        const newRooms = [...prev];
        [newRooms[idx], newRooms[idx+1]] = [newRooms[idx+1], newRooms[idx]];
        return newRooms;
      }
      return prev;
    });
  };

  // Drag and drop functions for room reordering
  const handleRoomDragStart = (e, index) => {
    setDraggedRoomIndex(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  const handleRoomDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedRoomIndex(null);
    setDragOverIndex(null);
  };

  const handleRoomDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleRoomDragLeave = (e) => {
    // Only clear dragOverIndex if we're actually leaving the row
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleRoomDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedRoomIndex === null || draggedRoomIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    
    setRoomsDraft(prev => {
      const newRooms = [...prev];
      const draggedRoom = newRooms[draggedRoomIndex];
      
      // Remove dragged room from its original position
      newRooms.splice(draggedRoomIndex, 1);
      
      // Insert dragged room at new position
      const adjustedDropIndex = draggedRoomIndex < dropIndex ? dropIndex - 1 : dropIndex;
      newRooms.splice(adjustedDropIndex, 0, draggedRoom);
      
      return newRooms;
    });
    
    setDraggedRoomIndex(null);
    setDragOverIndex(null);
  };


  // Enhanced room validation
  const validateRoom = (room) => {
    const errors = [];
    if (!room.id || room.id.trim() === '') {
      errors.push('Room ID is required');
    }
    if (!room.type) {
      errors.push('Room type is required');
    }
    if (room.nightlyRate < 0) {
      errors.push('Nightly rate cannot be negative');
    }
    if (room.weeklyRate < 0) {
      errors.push('Weekly rate cannot be negative');
    }
    return errors;
  };

  const applyTypeRatesToRooms = () => { 
    setRoomsDraft(prev => prev.map(r => ({
      ...r, 
      nightlyRate: typeRates[r.type]?.nightly ?? r.nightlyRate, 
      weeklyRate: typeRates[r.type]?.weekly ?? r.weeklyRate 
    }))); 
    toast.success('Applied type rates to rooms'); 
  };

  const saveRooms = async () => {
    const clean = roomsDraft.map((r, index) => ({
      ...r,
      id: (r.id || '').trim(),
      name: (r.name || '').trim(),
      type: ['powered','cabin','permanent'].includes(r.type) ? r.type : 'powered',
      nightlyRate: +(r.nightlyRate || 0),
      weeklyRate: +(r.weeklyRate || 0),
      lastReading: +(r.lastReading || 0),
      sortOrder: index, // Add sort order based on position in the list
    }));
    if (clean.some(r => !r.id)) { toast.error('All rooms must have an ID.'); return; }
    const seen = new Set();
    for (const r of clean) { if (seen.has(r.id)) { toast.error('Room IDs must be unique.'); return; } seen.add(r.id); }
    
    try {
      // Save each room to the database
      for (const room of clean) {
        await apiService.createRoom(room);
      }
      
      // Update room order in database
      await apiService.updateRoomsOrder(clean);
      
      // Update local state only after successful database save
      setLocalRooms(clean); 
      setRoomsOpen(false); 
      toast.success('Rooms updated and saved to database');
    } catch (error) {
      console.error('Error saving rooms to database:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to save rooms: ${errorMessage}`);
    }
  };

  const setRangeStart = () => {
  };

  // Check for booking conflicts
  const checkBookingConflicts = (roomId, startDate, endDate, excludeBookingId = null) => {
    return bookings.filter(b => {
      // Skip the booking we're editing (if any)
      if (excludeBookingId && b.id === excludeBookingId) return false;
      
      // Check if booking is in the same room
      if (b.roomId !== roomId) return false;
      
      // Check for date overlap
      const existingStart = new Date(b.start);
      const existingEnd = new Date(b.end);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      
      // Check if dates overlap
      return (newStart < existingEnd && newEnd > existingStart);
    });
  };

  // Show conflict dialog for date editing
  const showDateConflictDialog = (conflicts, newStartDate, newEndDate) => {
    setExistingBookingDialog({
      roomId: selection.roomId,
      date: newStartDate,
      booking: conflicts[0],
      isDateEdit: true,
      newStartDate,
      newEndDate,
      conflicts
    });
  };

  // Handle start date change with conflict checking
  const handleStartDateChange = (newStartDate) => {
    if (!selection) return;
    
    // Calculate the original duration
    const originalStartDate = new Date(selection.startDate);
    const originalEndDate = new Date(selection.endDate);
    const originalNights = Math.ceil((originalEndDate - originalStartDate) / (1000 * 60 * 60 * 24));
    
    // Calculate new end date to maintain the same duration
    const newStartDateObj = new Date(newStartDate);
    const newEndDateObj = addDays(newStartDateObj, originalNights);
    const newEndDate = dateKey(newEndDateObj);
    
    // Check for conflicts with the new date range
    const conflicts = checkBookingConflicts(selection.roomId, newStartDate, newEndDate);
    
    if (conflicts.length > 0) {
      showDateConflictDialog(conflicts, newStartDate, newEndDate);
      return;
    }
    
    // Update both start and end dates to maintain duration
    setSelection(prev => ({ 
      ...prev, 
      startDate: newStartDate,
      endDate: newEndDate
    }));
  };

  // Handle end date change with conflict checking
  const handleEndDateChange = (newEndDate) => {
    if (!selection) return;
    
    // Validate date range
    const validation = validateDateRange(selection.startDate, newEndDate);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    const conflicts = checkBookingConflicts(selection.roomId, selection.startDate, newEndDate);
    
    if (conflicts.length > 0) {
      showDateConflictDialog(conflicts, selection.startDate, newEndDate);
      return;
    }
    
    setSelection(prev => ({ ...prev, endDate: newEndDate }));
  };

  const handleCellClick = (roomId, dISO, e) => {
    // Don't open dialog if we just finished a drag operation
    if (justFinishedDrag) {
      return;
    }
    
    // Check for existing bookings starting on this date in this room
    const existingBookings = bookings.filter(b => 
      b.roomId === roomId && b.start === dISO
    );
    
    if (existingBookings.length > 0) {
      // Show error dialog with existing booking details
      const existingBooking = existingBookings[0];
      setExistingBookingDialog({
        roomId,
        date: dISO,
        booking: existingBooking
      });
      return;
    }
    
    // Calculate end date for 1-night minimum stay
    const startDate = new Date(dISO);
    const endDate = addDays(startDate, 1);
    const endDateISO = dateKey(endDate);
    
    // Always open the booking dialog on first click with 1-night minimum
    setSelection({ roomId, startDate: dISO, endDate: endDateISO });
    setCreateOpen(true);
    setWizardStep(0);
  };

  // Calculate total price based on selection and custom pricing
  const calculateTotalPrice = () => {
    if (!selection) return 0;
    
    // Validate date range first
    const validation = validateDateRange(selection.startDate, selection.endDate);
    if (!validation.isValid) {
      return 0; // Return 0 for invalid date ranges
    }
    
    const startDate = new Date(selection.startDate);
    const endDate = new Date(selection.endDate);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (form.customPricing) {
      return form.customPrice;
    }
    
    // Default pricing: $50 per night
    return nights * 50;
  };

  // Update total price when selection or custom pricing changes
  useEffect(() => {
    const total = calculateTotalPrice();
    setForm(prev => ({ ...prev, totalPrice: total }));
  }, [selection, form.customPricing, form.customPrice]);

  // Check if custom pricing warning should be shown
  const shouldShowCustomPricingWarning = () => {
    if (!form.customPricing || !customPricingSetAt || !originalDateRange || !selection) {
      return false;
    }
    
    const currentNights = Math.ceil((new Date(selection.endDate) - new Date(selection.startDate)) / (1000 * 60 * 60 * 24));
    return currentNights !== originalDateRange.nights;
  };

  // Validate all bookings whenever bookings change
  useEffect(() => {
    const validation = validateAllBookings();
    if (!validation.isValid) {
      console.warn('Invalid bookings detected:', validation.invalidBookings);
    }
  }, [bookings]);

  const clearSelection = () => setSelection(null);

  // Handle booking click to show details
  const handleBookingClick = useCallback(async (booking) => {
    if (dataLoading) {
      return;
    }
    
    // Always use the booking from the current bookings array to ensure we have the latest data
    const latestBooking = bookings.find(b => b.id === booking.id) || booking;
    setSelectedBooking(latestBooking);
    
    // Get client data from the joined query result
    const clientData = {
      name: latestBooking.guestName || '',
      phone: latestBooking.phone || '',
      email: latestBooking.email || '',
      notes: latestBooking.notes || '',
      extraPaid: latestBooking.extraPaid || 0,
      paymentMethod: latestBooking.paymentMethod || 'cash'
    };
    
    setEditingCustomerData(clientData);
    
    // Load payment history for this specific booking only
    try {
      const payments = await apiService.getPaymentsByBooking(latestBooking.id);
      setPaymentHistory(payments);
      // Attach payments to selectedBooking for Payment Summary calculations
      setSelectedBooking(prev => ({ ...prev, payments }));
    } catch (error) {
      console.error(`Error loading payments for booking ${latestBooking.id}:`, error);
      setPaymentHistory([]);
      // Still attach empty payments array to prevent undefined errors
      setSelectedBooking(prev => ({ ...prev, payments: [] }));
    }
    
    setBookingDetailsOpen(true);
  }, [bookings, dataLoading]);

  // Start editing booking
  const startEditingDates = () => {
    if (!selectedBooking) return;
    setEditingBooking(true);
    setEditingBookingData({
      startDate: selectedBooking.start || selectedBooking.startDate,
      endDate: selectedBooking.end || selectedBooking.endDate,
      roomId: selectedBooking.roomId,
      status: selectedBooking.checkedOut ? 'checked_out' : 
              selectedBooking.checkedIn ? 'checked_in' : 'not_checked_in',
      totalPrice: selectedBooking.totalPrice || 0
    });
  };

  // Cancel editing booking
  const cancelEditingDates = () => {
    setEditingBooking(false);
    setEditingBookingData({ startDate: '', endDate: '', roomId: '', status: 'not_checked_in', totalPrice: 0 });
  };

  // Handle booking data change in booking details
  const handleBookingDateChange = (field, value) => {
    setEditingBookingData(prev => ({ ...prev, [field]: value }));
  };

  // Save booking changes
  const saveDateChanges = async () => {
    if (!selectedBooking) return;
    
    // Validate date range using comprehensive validation
    const validation = validateDateRange(editingBookingData.startDate, editingBookingData.endDate);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    // Check for conflicts (excluding current booking) - use new roomId if changed
    const roomId = editingBookingData.roomId || selectedBooking.roomId;
    const conflicts = checkBookingConflicts(
      roomId, 
      editingBookingData.startDate, 
      editingBookingData.endDate, 
      selectedBooking.id
    );
    
    if (conflicts.length > 0) {
      alert('The selected dates conflict with an existing booking. Please choose different dates.');
      return;
    }
    
    // Create updated booking and validate it
    const updatedBooking = {
      ...selectedBooking,
      start: editingBookingData.startDate,
      end: editingBookingData.endDate,
      startDate: editingBookingData.startDate, // Also set startDate for compatibility
      endDate: editingBookingData.endDate,     // Also set endDate for compatibility
      roomId: roomId,
      checkedIn: editingBookingData.status === 'checked_in',
      checkedOut: editingBookingData.status === 'checked_out',
      totalPrice: editingBookingData.totalPrice || validation.nights * 50 // Use edited totalPrice or fallback to calculated
    };
    
    // Final validation of the complete booking
    const bookingValidation = validateBooking(updatedBooking);
    if (!bookingValidation.isValid) {
      alert(bookingValidation.message);
      return;
    }
    
    try {
      // Save to database first
      await saveBookingToDatabase(updatedBooking);
      
      // Update local state
      setBookings(prev => prev.map(b => 
        b.id === selectedBooking.id ? updatedBooking : b
      ));
      
      setSelectedBooking(updatedBooking);
      setEditingBooking(false);
      setEditingBookingData({ startDate: '', endDate: '', roomId: '', status: 'not_checked_in', totalPrice: 0 });
      
      // Reload data from database to ensure consistency
      const freshData = await reloadDataFromDatabase();
      if (freshData) {
        // Update selectedBooking with fresh data
        const updatedBookingFromDB = freshData.bookings.find(b => b.id === selectedBooking.id);
        if (updatedBookingFromDB) {
          setSelectedBooking(updatedBookingFromDB);
        }
      }
      
      // Show success message
      toast.success('Booking updated successfully!');
      
    } catch (error) {
      console.error('Error saving booking:', error);
      toast.error('Failed to save booking changes. Please try again.');
    }
  };

  // Check in/out booking
  const toggleCheckIn = () => {
    if (!selectedBooking) return;
    
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    
    const isCurrentlyCheckedIn = selectedBooking.checkedIn;
    const updatedBooking = {
      ...selectedBooking,
      checkedIn: !isCurrentlyCheckedIn,
      checkInDate: !isCurrentlyCheckedIn ? dateString : selectedBooking.checkInDate,
      checkInTime: !isCurrentlyCheckedIn ? timeString : selectedBooking.checkInTime,
      checkOutDate: isCurrentlyCheckedIn ? dateString : selectedBooking.checkOutDate,
      checkOutTime: isCurrentlyCheckedIn ? timeString : selectedBooking.checkOutTime,
      checkedOut: isCurrentlyCheckedIn ? true : false // Add checkedOut flag
    };
    
    setBookings(prev => prev.map(b => 
      b.id === selectedBooking.id ? updatedBooking : b
    ));
    
    setSelectedBooking(updatedBooking);
    
    
    // If checking out, automatically prompt for power meter reading
    if (isCurrentlyCheckedIn) {
      setTimeout(() => {
        openPowerMeterReadingPopup();
      }, 500); // Small delay to ensure UI updates
    }
  };

  // Delete booking function
  const deleteBooking = () => {
    if (!selectedBooking) return;
    
    // Store booking details for confirmation message
    const bookingDetails = {
      clientName: selectedBooking.name || selectedBooking.guest || 'Unknown Client',
      site: selectedBooking.roomId,
      dates: `${selectedBooking.start} to ${selectedBooking.end}`
    };
    
    // Remove booking from bookings array
    setBookings(prev => {
      const newBookings = prev.filter(b => b.id !== selectedBooking.id);
      return newBookings;
    });
    
    // Delete booking from database
    deleteBookingFromDatabase(selectedBooking.id);
    
    
    // Close booking details dialog
    setBookingDetailsOpen(false);
    setSelectedBooking(null);
    
    // Show confirmation dialog
    setDeleteConfirmationDialog(bookingDetails);
    
    // Auto-close confirmation dialog after 3 seconds
    setTimeout(() => {
      setDeleteConfirmationDialog(null);
    }, 3000);
  };

  // Add payment to booking
  const addPaymentToBooking = async () => {
    if (!selectedBooking || paymentAmount <= 0 || !paymentMethod) return;
    
    try {
      const actualAmount = isRefund ? -paymentAmount : paymentAmount;
      
      // Check if refund amount exceeds total paid
      if (isRefund && Math.abs(actualAmount) > (selectedBooking.totalPaid || 0)) {
        setRefundAmount(Math.abs(actualAmount));
        setRefundReason('');
        setRefundBookingId(selectedBooking.id);
        setRefundPaymentMethodId(paymentMethod);
        setRefundWarningOpen(true);
        return;
      }
      
      const payment = {
        id: generateId(),
        bookingId: selectedBooking.id,
        clientId: selectedBooking.clientId,
        amount: actualAmount,
        paymentType: isRefund ? 'refund' : 'payment',
        paymentMethodId: paymentMethod,
        reason: isRefund ? 'Refund processed' : null,
        processedBy: 'system'
      };

      await apiService.createPayment(payment);
      
      // Get updated payment history for this booking
      const updatedPayments = await apiService.getPaymentsByBooking(selectedBooking.id);
      
      // Update the booking's totalPaid field
      await updateBookingTotalPaid(selectedBooking.id, updatedPayments);
      
      // Update the selected booking with the latest payment data
      setSelectedBooking(prev => ({ ...prev, payments: updatedPayments }));
      setPaymentHistory(updatedPayments);
      
      // Reset payment form and close dialog
      setPaymentAmount(0);
      setPaymentMethod('');
      setIsRefund(false);
      setPaymentDialogOpen(false);
      
      toast.success(isRefund ? 'Refund processed successfully' : 'Payment processed successfully');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    }
  };

  // Add payment amount helper
  const addToPaymentAmount = (amount) => {
    setPaymentAmount(prev => prev + amount);
  };

  // Process refund with warning
  const processRefund = async () => {
    if (!refundAcknowledged) {
      toast.error('Please acknowledge the refund warning');
      return;
    }

    try {
      const refundPayment = {
        id: generateId(),
        bookingId: refundBookingId,
        clientId: selectedBooking.clientId,
        amount: -Math.abs(refundAmount), // Negative amount for refund
        paymentType: 'refund',
        paymentMethodId: refundPaymentMethodId,
        reason: refundReason,
        processedBy: 'system'
      };

      await apiService.createPayment(refundPayment);
      
      // Get updated payment history for this booking
      const updatedPayments = await apiService.getPaymentsByBooking(selectedBooking.id);
      
      // Update the booking's totalPaid field
      await updateBookingTotalPaid(selectedBooking.id, updatedPayments);
      
      // Update the selected booking with the latest payment data
      setSelectedBooking(prev => ({ ...prev, payments: updatedPayments }));
      setPaymentHistory(updatedPayments);
      
      setRefundWarningOpen(false);
      setRefundAmount(0);
      setRefundReason('');
      setRefundBookingId('');
      setRefundPaymentMethodId('');
      setRefundAcknowledged(false);
      
      toast.success('Refund processed successfully');
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Failed to process refund');
    }
  };

  // Calculate booking totals from payments
  const calculateBookingTotals = (booking) => {
    // Use the booking's totalAmount and totalPaid fields directly
    const totalAmount = booking.totalAmount || 0;
    const totalPaid = booking.totalPaid || 0;
    
    // Calculate refunds from payments if available
    const totalRefunded = booking.payments ? Math.abs(booking.payments
      .filter(p => p.amount < 0)
      .reduce((sum, p) => sum + p.amount, 0)) : 0;
      
    return {
      totalPaid,
      totalRefunded,
      netAmount: totalAmount - totalPaid  // This is the key fix: totalAmount - totalPaid
    };
  };

  // Update booking totalPaid field when payments change
  const updateBookingTotalPaid = async (bookingId, payments) => {
    // Calculate net total paid from all payments (including refunds)
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Update the booking in the database
    try {
      await apiService.updateBooking(bookingId, { totalPaid });
      
      // Update the booking in local state
      setBookings(prev => prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, totalPaid }
          : booking
      ));
      
      // Update selected booking if it's the same one
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(prev => ({ ...prev, totalPaid }));
      }
    } catch (error) {
      console.error('Error updating booking totalPaid:', error);
    }
  };

  // Generate unique ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Add payment to booking
  const addPayment = (amount, method = 'cash') => {
    if (!selectedBooking || amount <= 0) return;
    
    const updatedBooking = {
      ...selectedBooking,
      extraPaid: (selectedBooking.extraPaid || 0) + amount,
      paymentMethod: method
    };
    
    setBookings(prev => prev.map(b => 
      b.id === selectedBooking.id ? updatedBooking : b
    ));
    
      setSelectedBooking(updatedBooking);
      setEditingCustomerData(prev => ({ ...prev, extraPaid: updatedBooking.extraPaid }));
  };

  const wizardNext = () => setWizardStep(s => Math.min(s + 1, 4));
  const wizardBack = () => setWizardStep(s => Math.max(s - 1, 0));

  const wizardNextWithValidation = () => {
    if (wizardStep === 0) {
      if (!form.name.trim()) {
        showValidationDialog('name', '', () => {
          wizardNext();
        });
        return;
      }
      if (!validateCustomerName(form.name)) {
        showValidationDialog('name', form.name, () => {
          setSkipTitleCaseValidation(true);
          wizardNext();
        });
        return;
      }
      // Only check Title Case if word count/length validation passed AND user hasn't overridden it
      if (!skipTitleCaseValidation && !isTitleCase(form.name)) {
        showValidationDialog('titlecase', form.name, () => {
          wizardNext();
        });
        return;
      }
    }
    if (wizardStep === 1) {
      if (!form.phone.trim() && !form.skipPhone) {
        showValidationDialog('phone', '', () => {
          wizardNext();
        });
        return;
      }
      if (form.phone.trim() && !validatePhone(form.phone)) {
        showValidationDialog('phone', form.phone, () => {
          wizardNext();
        });
        return;
      }
    }
    if (wizardStep === 2) {
      if (!form.email.trim() && !form.skipEmail) {
        showValidationDialog('email', '', () => {
          wizardNext();
        });
        return;
      }
      if (form.email.trim() && !validateEmail(form.email)) {
        showValidationDialog('email', form.email, () => {
          wizardNext();
        });
        return;
      }
    }
    if (wizardStep === 3) {
      // Power meter reading validation - ensure a reading is entered
      if (!form.startPowerReading || form.startPowerReading <= 0) {
        toast.error('Please enter a valid starting power meter reading');
        return;
      }
    }
    wizardNext();
  };

  // Helper function to reload all data from database
  const reloadDataFromDatabase = async () => {
    try {
      const freshData = await apiService.getAllData();
      
      if (freshData.bookings && freshData.bookings.length > 0) {
        // Set bookings without loading payment data - payments will be loaded on-demand
        // Ensure each booking has a payments property initialized
        const bookingsWithPayments = freshData.bookings.map(booking => ({
          ...booking,
          payments: booking.payments || []
        }));
        setBookings(bookingsWithPayments);
      } else {
        setBookings(freshData.bookings || []);
      }
      
      if (freshData.rooms) {
        setLocalRooms(freshData.rooms);
      }
      if (freshData.clients) {
        setClients(freshData.clients);
      }
      return freshData;
    } catch (error) {
      console.warn('Failed to reload data from database:', error);
      return null;
    }
  };

  // Helper function to save client to database
  const saveClientToDatabase = async (client) => {
    try {
      // Data is already in the correct format (camelCase)
      const dbClient = {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        isDeleted: client.isDeleted ? 1 : 0,
        deletedDate: client.deletedDate
      };

      const result = await apiService.createClient(dbClient);
    } catch (error) {
      console.error('Error saving client to database:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to save client: ${errorMessage}`);
    }
  };

  // Helper function to delete booking from database
  const deleteBookingFromDatabase = async (bookingId) => {
    try {
      const result = await apiService.deleteBooking(bookingId);
    } catch (error) {
      console.error('Error deleting booking from database:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to delete booking: ${errorMessage}`);
    }
  };

  // Helper function to save booking to database (handles both create and update)
  const saveBookingToDatabase = async (booking) => {
    try {
      // Convert frontend data to database format
      const dbBooking = {
        id: booking.id,
        roomId: booking.roomId,
        clientId: booking.clientId,
        startDate: booking.startDate || booking.start,
        endDate: booking.endDate || booking.end,
        totalAmount: booking.totalAmount || booking.totalPrice || 0,
        totalPaid: booking.totalPaid || 0,
        notes: booking.notes || '',
        checkedIn: booking.checkedIn ? 1 : 0,
        checkedOut: booking.checkedOut ? 1 : 0,
        customPricing: booking.customPricing ? 1 : 0,
        customPrice: booking.customPrice || 0,
        startPowerReading: booking.startPowerReading || 0,
        endPowerReading: booking.endPowerReading || 0,
        powerCost: booking.powerCost || 0,
        status: booking.status || 'confirmed'
      };


      // Check if booking already exists in the database
      const existingBooking = bookings.find(b => b.id === booking.id);
      
      let result;
      if (existingBooking) {
        result = await apiService.updateBooking(booking.id, dbBooking);
      } else {
        result = await apiService.createBooking(dbBooking);
      }
      
      return result;
    } catch (error) {
      console.error('Error saving booking to database:', error);
      const errorMessage = apiService.getErrorMessage(error);
      toast.error(`Failed to save booking: ${errorMessage}`);
      throw error;
    }
  };

  const createBooking = async () => {
    if (!selection || !form.name.trim()) return;
    if (!form.phone.trim() && !form.skipPhone) return;
    if (!form.email.trim() && !form.skipEmail) return;
    
    // Validate date range
    const validation = validateDateRange(selection.startDate, selection.endDate);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }
    
    setIsCreatingBooking(true);
    
    try {
      // Parse name into first and last name
      const nameParts = form.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Find or create client
      const clientId = findOrCreateClient(
        firstName,
        lastName,
        form.phone.trim() || '',
        form.email.trim() || ''
      );
      
      const newBooking = {
        id: `booking-${Date.now()}`,
        roomId: selection.roomId,
        clientId: clientId,
        startDate: selection.startDate,
        endDate: selection.endDate,
        start: selection.startDate, // Add for compatibility
        end: selection.endDate, // Add for compatibility
        totalAmount: form.totalPrice || 0,
        totalPaid: 0,
        notes: form.notes || '',
        checkedIn: false,
        checkedOut: false,
        customPricing: form.customPricing,
        customPrice: form.customPrice || 0,
        startPowerReading: form.startPowerReading || 0,
        endPowerReading: 0,
        powerCost: 0,
        status: 'confirmed',
        // Add client information for display
        guestName: form.name || '',
        phone: form.phone || '',
        email: form.email || '',
        payments: [] // Initialize empty payments array
      };
      
      // Save to database first
      await saveBookingToDatabase(newBooking);
      
      // Add the new booking to local state instead of reloading all data
      setBookings(prev => [newBooking, ...prev]);
      
      // Add booking to client history
      addBookingToClientHistory(clientId, newBooking.id, newBooking);
      
      // Mark as changed
      
      // Reset form and close dialog
      setForm({
        name: '',
        phone: '',
        email: '',
        depositPaid: false,
        depositAmount: 0,
        depositPaymentMethod: 'cash',
        extraPaid: 0,
        paymentMethod: 'cash',
        notes: '',
        customPricing: false,
        customPrice: 0,
        totalPrice: 0,
        skipPhone: false,
        skipEmail: false,
        startPowerReading: 0
      });
      setCreateOpen(false);
      clearSelection();
      setWizardStep(0);
      setShowCancelConfirm(false);
      
      // Show the booking details page for the newly created booking
      // Use the newBooking object directly since we just created it
      setSelectedBooking(newBooking);
      
      // Get client data for the booking details
      const clientData = {
        name: newBooking.guestName || '',
        phone: newBooking.phone || '',
        email: newBooking.email || '',
        notes: newBooking.notes || '',
        extraPaid: newBooking.extraPaid || 0,
        paymentMethod: newBooking.paymentMethod || 'cash'
      };
      
      setEditingCustomerData(clientData);
      setPaymentHistory(newBooking.payments || []); // Initialize with empty payment history
      setBookingDetailsOpen(true);
      
      toast.success('Booking created successfully!');
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const handleCancelBooking = () => {
    if (wizardStep > 0 || form.name || form.phone || form.email || form.customPrice > 0 || form.notes || form.customPricing || form.startPowerReading > 0) {
      setShowCancelConfirm(true);
    } else {
      closeBookingDialog();
    }
  };

  const closeBookingDialog = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      depositPaid: false,
      depositAmount: 0,
      depositPaymentMethod: 'cash',
      extraPaid: 0,
      paymentMethod: 'cash',
      notes: '',
      customPricing: false,
      customPrice: 0,
      totalPrice: 0,
      skipPhone: false,
      skipEmail: false,
      startPowerReading: 0
    });
    setCreateOpen(false);
    clearSelection();
    setWizardStep(0);
    setShowCancelConfirm(false);
    setSkipTitleCaseValidation(false);
  };

  const handleKeyDown = (e) => {
    if (!createOpen) return;
    
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancelBooking();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      if (wizardStep < 3) {
        // Only proceed if current step is valid
        if (wizardStep === 0 && form.name.trim()) {
          wizardNextWithValidation();
        } else if (wizardStep === 1) {
          wizardNextWithValidation();
        } else if (wizardStep === 2) {
          wizardNextWithValidation();
        }
      } else {
        // Final step - create booking
        createBooking();
      }
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    if (createOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [createOpen, wizardStep, form]);

  // Prepopulate starting power reading when entering step 3
  useEffect(() => {
    if (wizardStep === 3 && selection) {
      const room = localRooms.find(r => r.id === selection.roomId);
      const lastReading = room ? room.lastReading : 0;
      if (lastReading > 0 && form.startPowerReading === 0) {
        setForm(prev => ({ ...prev, startPowerReading: lastReading }));
      }
    }
  }, [wizardStep, selection, localRooms, form.startPowerReading]);


  // Booking creation functions

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" style={{fontFamily:'var(--sb-font)'}}>
      {/* Data Loading Error Banner */}
      {dataLoadingError && (
        <div className="fixed top-0 left-0 right-0 z-[8000] bg-red-600 text-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="font-medium">Data Loading Error: {dataLoadingError}</span>
            <button 
              onClick={() => setDataLoadingError(null)}
              className="ml-4 text-white hover:text-gray-200"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Data Loading Banner */}
      {dataLoading && (
        <div className="fixed top-0 left-0 right-0 z-[8000] bg-blue-600 text-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="font-medium">Loading data from database...</span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className={`fixed left-0 right-0 z-[7000] bg-white border-b shadow-sm ${dataLoadingError ? 'top-12' : dataLoading ? 'top-12' : 'top-0'}`}>
        <div className="px-3 py-3 flex items-center gap-2">
          <h1 className="text-xl font-bold mr-2">🏕️ Holiday Park Bookings</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button 
              variant="outline" 
              className="text-xs sm:text-sm p-2" 
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Hidden file input for import */}
      <input 
        ref={importInputRef} 
        type="file" 
        accept="application/json" 
        className="hidden" 
        onChange={(e) => { 
          const f = e.target.files?.[0]; 
          if (f) importData(f); 
          e.target.value = ""; 
        }} 
      />

      {/* Tabs Section */}
      <div className={`${dataLoadingError || dataLoading ? 'pt-28' : 'pt-16'}`}>
        <Tabs defaultValue="board">
          <TabsList className={`mb-0 w-full fixed left-0 right-0 z-[6500] bg-white border-b ${dataLoadingError || dataLoading ? 'top-12' : 'top-16'}`}>
            <div className="px-3 w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {/* Add navigation logic if needed */}}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  Bookings
                </button>
                <button 
                  onClick={() => {/* Add navigation logic if needed */}}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  Reports
                </button>
                <button 
                  onClick={() => setClientsOpen(true)}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  Clients
                </button>
                <button 
                  onClick={setRoomsOpen}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  Sites
                </button>
                <button 
                  onClick={() => setPaymentsOpen(true)}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  Payments
                </button>
              </div>
              
              <div className="flex-1 flex justify-center">
                <button
                  onClick={handleResetToToday}
                  className="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 flex items-center gap-2"
                >
                  <span>📅</span>
                  <span>Jump to Today</span>
                </button>
              </div>
              
              {/* Booking Status Legend */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-200 rounded"></div>
                  <span className="text-xs text-gray-600">Upcoming</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-emerald-200 rounded"></div>
                  <span className="text-xs text-gray-600">Paid</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-200 rounded"></div>
                  <span className="text-xs text-gray-600">Partial</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-rose-200 rounded"></div>
                  <span className="text-xs text-gray-600">Overdue</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-300 rounded"></div>
                  <span className="text-xs text-gray-600">Past</span>
                </div>
              </div>
            </div>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar Grid Content */}
      <div className="pt-16 px-1 py-1">
        <InfiniteCalendarGrid 
          ref={infiniteCalendarRef}
          typeVisible={typeVisible} 
          setTypeVisible={setTypeVisible}
          toggleTypeVisible={toggleTypeVisible}
          selection={selection}
          onCellClick={handleCellClick}
          bookings={bookings}
          setBookings={setBookings}
          barDrag={barDrag}
          setBarDrag={setBarDrag}
          startBarDrag={startBarDrag}
          roomsData={filteredRoomsData}
          gridMetricsRef={gridMetricsRef}
          dragging={dragging}
          handleMouseDown={handleMouseDown}
          dragRoomRef={dragRoomRef}
          dragStartRef={dragStartRef}
          setSelection={setSelection}
          handleBookingClick={handleBookingClick}
          setCellTooltip={setCellTooltip}
          setTooltipPosition={setTooltipPosition}
          validateDateRange={validateDateRange}
        />
      </div>

      {/* Booking Creation Dialog */}
      {createOpen && selection && (
        <div className="fixed inset-0 z-[8000] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] mx-4 flex flex-col">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold">
                {wizardStep === 0 ? 'Create New Booking' : `New Booking for ${form.name}`}
              </h2>
              <button 
                onClick={handleCancelBooking}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close booking dialog"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {wizardStep === 0 && (
                <div className="space-y-4">
                  {/* Booking Details */}
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <h3 className="text-lg font-medium mb-3">Booking Details</h3>
                    
                    {/* Room Selection */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Room</label>
                      <div className="text-sm font-medium text-gray-900">{selection.roomId}</div>
                    </div>

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={selection.startDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                        <input
                          type="date"
                          value={selection.endDate}
                          onChange={(e) => handleEndDateChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Custom Pricing Warning - only show when date range changes */}
                    {shouldShowCustomPricingWarning() && (
                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="text-xs text-yellow-800">
                          ⚠️ <strong>Custom Pricing set at ${form.customPrice} {form.customPricingType === 'perNight' ? 'Per Night' : 'Total'}</strong> | ${form.customPricingType === 'perNight' ? (form.customPrice * Math.ceil((new Date(selection.endDate) - new Date(selection.startDate)) / (1000 * 60 * 60 * 24))).toFixed(0) : form.customPrice} Total, please double check now you've updated the date range.
                        </div>
                      </div>
                    )}

                    {/* Quick Week Selection Buttons */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-2">Quick Select Duration</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(weeks => (
                          <button
                            key={weeks}
                            onClick={() => {
                              if (selection.startDate) {
                                const startDate = new Date(selection.startDate);
                                const endDate = addDays(startDate, weeks * 7);
                                const endDateISO = dateKey(endDate);
                                handleEndDateChange(endDateISO);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          >
                            {weeks}W
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration Display */}
                    <div className="text-xs text-gray-500">
                      Duration: {(() => {
                        const startDate = new Date(selection.startDate);
                        const endDate = new Date(selection.endDate);
                        const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                        return `${nights} night${nights !== 1 ? 's' : ''}`;
                      })()}
                    </div>
                  </div>
                  {/* Pricing Information */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3">Pricing & Quote</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Room:</strong> {selection.roomId}
                      </div>
                      <div>
                        <strong>Nights:</strong> {(() => {
                          const startDate = new Date(selection.startDate);
                          const endDate = new Date(selection.endDate);
                          return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                        })()}
                      </div>
                      <div>
                        <strong>Standard Rate:</strong> $50/night
                      </div>
                      <div>
                        <strong>Total:</strong> ${form.totalPrice}
                      </div>
                    </div>
                    
                    {/* Custom Pricing Option */}
                    <div className="mt-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          checked={form.customPricing}
                          onChange={(e) => {
                            const isEnabled = e.target.checked;
                            setForm(prev => ({ ...prev, customPricing: isEnabled }));
                            
                            // Track when custom pricing is enabled and current date range
                            if (isEnabled && selection) {
                              setCustomPricingSetAt(Date.now());
                              setOriginalDateRange({
                                startDate: selection.startDate,
                                endDate: selection.endDate,
                                nights: Math.ceil((new Date(selection.endDate) - new Date(selection.startDate)) / (1000 * 60 * 60 * 24))
                              });
                            } else if (!isEnabled) {
                              setCustomPricingSetAt(null);
                              setOriginalDateRange(null);
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Use custom pricing</span>
                      </label>
                      
                      
                      {form.customPricing && (
                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md">
                          {/* Pricing Type Toggle */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-2">Pricing Type</label>
                            <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, customPricingType: 'perNight' }))}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                  form.customPricingType === 'perNight' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Per Night
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, customPricingType: 'total' }))}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                  form.customPricingType === 'total' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Total Price
                              </button>
                            </div>
                          </div>

                          {/* Price Input */}
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {form.customPricingType === 'total' ? 'Total Price' : 'Price per Night'}
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 text-sm">$</span>
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.customPrice}
                                onChange={(e) => {
                                  const limitedValue = limitToTwoDecimals(e.target.value);
                                  setForm(prev => ({ ...prev, customPrice: limitedValue }));
                                }}
                                className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={`Enter ${form.customPricingType === 'total' ? 'total' : 'per night'} price`}
                              />
                            </div>
                          </div>

                          {/* Calculated Price Display */}
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            {form.customPricingType === 'total' ? (
                              <div>
                                <strong>Total Price:</strong> ${form.customPrice || 0}
                                {(() => {
                                  const nights = Math.ceil((new Date(selection.endDate) - new Date(selection.startDate)) / (1000 * 60 * 60 * 24));
                                  const perNight = nights > 0 ? (form.customPrice / nights).toFixed(2) : 0;
                                  return nights > 0 ? ` ($${perNight}/night for ${nights} nights)` : '';
                                })()}
                              </div>
                            ) : (
                              <div>
                                <strong>Per Night:</strong> ${form.customPrice || 0}
                                {(() => {
                                  const nights = Math.ceil((new Date(selection.endDate) - new Date(selection.startDate)) / (1000 * 60 * 60 * 24));
                                  const total = (form.customPrice * nights).toFixed(2);
                                  return nights > 0 ? ` (Total: $${total} for ${nights} nights)` : '';
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Guest Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guest Name *
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={form.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm(prev => ({ ...prev, name: value }));
                          searchClients(value);
                        }}
                        onFocus={() => {
                          if (form.name.trim()) {
                            searchClients(form.name);
                          }
                        }}
                        onBlur={(e) => {
                          // Only hide suggestions if the blur is not caused by clicking on a suggestion
                          const relatedTarget = e.relatedTarget;
                          if (!relatedTarget || !relatedTarget.closest('.client-suggestion')) {
                            setTimeout(() => setShowSuggestions(false), 200);
                          }
                        }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter guest name or phone number"
                      autoFocus
                    />
                    
                    {/* Help message */}
                    <div className="mt-1 text-xs text-gray-500">
                      💡 You can search for existing customers by typing their name or phone number
                    </div>
                      
                      {/* Client Suggestions Dropdown */}
                      {showSuggestions && clientSuggestions.length > 0 && (
                        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                          {clientSuggestions.map((client) => (
                            <div
                              key={client.id}
                              className="client-suggestion px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                selectClientSuggestion(client);
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium">{client.firstName} {client.lastName}</div>
                                  <div className="text-sm text-gray-600">
                                    {client.phone && <span>📞 {client.phone}</span>}
                                    {client.email && <span className="ml-2">✉️ {client.email}</span>}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Last booking: {client.lastBookingDate} • Total bookings: {client.totalBookings}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openClientHistory(client);
                                  }}
                                  className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  History
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Client Status Indicator */}
                      {form.name && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md border">
                          {(() => {
                            // Check if this matches an existing client
                            const matchingClient = clients.find(client => {
                              const clientName = `${client.firstName} ${client.lastName}`.trim().toLowerCase();
                              return clientName === form.name.toLowerCase();
                            });
                            
                            if (matchingClient) {
                              return (
                                <div className="flex items-center text-sm">
                                  <div className="flex items-center text-green-600">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium">Using existing client</span>
                                  </div>
                                  <div className="ml-4 text-gray-600">
                                    {matchingClient.phone && `📞 ${matchingClient.phone}`}
                                    {matchingClient.phone && matchingClient.email && ' • '}
                                    {matchingClient.email && `✉️ ${matchingClient.email}`}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center text-sm">
                                  <div className="flex items-center text-blue-600">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium">Creating new client</span>
                                  </div>
                                  <div className="ml-4 text-gray-500 text-xs">
                                    This client will be added to your client database
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm(prev => ({ ...prev, phone: fmtPhoneAUInput(val) }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 04xx xxx xxx"
                    />
                  </div>
                  
                  {!form.phone.trim() && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <label className="flex items-start">
                        <input
                          type="checkbox"
                          checked={form.skipPhone}
                          onChange={(e) => setForm(prev => ({ ...prev, skipPhone: e.target.checked }))}
                          className="mr-2 mt-1"
                        />
                        <span className="text-sm text-yellow-800">
                          To keep our records up to date, please enter a phone number. 
                          <strong> Tick to confirm to continue without entering phone number.</strong>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter email address"
                    />
                  </div>
                  
                  {!form.email.trim() && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <label className="flex items-start">
                        <input
                          type="checkbox"
                          checked={form.skipEmail}
                          onChange={(e) => setForm(prev => ({ ...prev, skipEmail: e.target.checked }))}
                          className="mr-2 mt-1"
                        />
                        <span className="text-sm text-yellow-800">
                          To keep our records up to date, please enter an email address. 
                          <strong> Tick to confirm to continue without entering email address.</strong>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-3">Starting Power Meter Reading</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Please confirm the starting power meter reading for this booking.
                    </p>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Starting Power Reading (kWh)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.startPowerReading}
                        onChange={(e) => setForm(prev => ({ ...prev, startPowerReading: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter starting reading"
                      />
                    </div>
                    
                    {/* Show information about last reading */}
                    {(() => {
                      const room = localRooms.find(r => r.id === selection.roomId);
                      const lastReading = room ? room.lastReading : 0;
                      const hasRecentReading = lastReading > 0;
                      
                      return (
                        <div className={`mt-4 p-3 rounded-md ${hasRecentReading ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                          {hasRecentReading ? (
                            <div>
                              <p className="text-sm text-green-800 font-medium">
                                ✓ Last reading: {lastReading} kWh
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                This reading was confirmed at the end of the last booking.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm text-yellow-800 font-medium">
                                ⚠ No confirmed reading from last booking
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Please double-check this reading as it wasn't confirmed after the last booking.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              
            </div>
            
            {/* Fixed Footer */}
            <div className="flex justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                {wizardStep === 0 ? (
                  <Button
                    onClick={closeBookingDialog}
                    className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                  >
                    Cancel
                  </Button>
                ) : (
                <Button
                  onClick={wizardBack}
                  variant="outline"
                  className="text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  Back
                </Button>
                )}
                
                {wizardStep < 3 ? (
                  <Button
                    onClick={wizardNextWithValidation}
                    disabled={
                      (wizardStep === 0 && !form.name.trim()) ||
                      (wizardStep === 1 && !form.phone.trim() && !form.skipPhone) ||
                      (wizardStep === 2 && !form.email.trim() && !form.skipEmail)
                    }
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={createBooking}
                    disabled={isCreatingBooking || (!form.startPowerReading || form.startPowerReading <= 0)}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingBooking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Create Booking'
                    )}
                  </Button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[9000] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Are you sure you want to cancel the new booking?</h3>
              <p className="text-gray-600 mb-6">
                Any information entered will be lost.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Continue Booking
                </button>
                <button
                  onClick={closeBookingDialog}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Cancel booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Dialog */}
      {validationDialog && (
        <div 
          className="fixed inset-0 z-[11000] bg-black bg-opacity-50 flex items-center justify-center"
          data-validation-dialog
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleValidationCancel();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          tabIndex={0}
          autoFocus
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {validationDialog.type === 'name' || validationDialog.type === 'titlecase' ? 'Name Warning' : 'Validation Warning'}
              </h3>
              <p className="text-gray-600 mb-6">
                {validationDialog.type === 'phone' ? (
                  <>
                    Phone number <strong>"{validationDialog.value}"</strong> doesn't seem to be a correct phone format. Are you sure this is correct?
                  </>
                ) : validationDialog.type === 'email' ? (
                  <>
                    Email <strong>"{validationDialog.value}"</strong> doesn't seem to be a correct email format. Are you sure this is correct?
                  </>
                ) : validationDialog.type === 'titlecase' ? (
                  <>
                    Should we correct this to <strong>"{toTitleCase(validationDialog.value)}"</strong>?
                  </>
                ) : (
                  <>
                    Please enter First and Last name of customer.
                  </>
                )}
              </p>
              {validationDialog.type === 'name' && (
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={overrideNameValidation}
                      onChange={(e) => setOverrideNameValidation(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Ignore warning and continue with "{validationDialog.value}"</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleValidationCancel}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Go Back
                </button>
                {validationDialog.type === 'name' ? (
                  <>
                    {overrideNameValidation && (
                <button
                  onClick={handleValidationProceed}
                  className="px-4 py-2 bg-orange-300 text-white rounded-md hover:bg-orange-400"
                >
                        Ignore and Continue
                      </button>
                    )}
                  </>
                ) : validationDialog.type === 'titlecase' ? (
                  <>
                    <button
                      onClick={handleValidationProceed}
                      className="px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                    >
                      Use "{validationDialog.value}"
                    </button>
                    <button
                      onClick={handleTitleCaseCorrection}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Use "{toTitleCase(validationDialog.value)}"
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleValidationProceed}
                      className="px-4 py-2 bg-orange-300 text-white rounded-md hover:bg-orange-400"
                    >
                      Confirm and Continue
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Booking Details Dialog */}
      {bookingDetailsOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-[9000] bg-black bg-opacity-50 flex items-center justify-center"
          tabIndex={0}
          autoFocus
          data-booking-details-dialog
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Booking Details</h2>
                <button 
                  onClick={() => setBookingDetailsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              {/* Booking Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-end mb-4">
                    <button
                    onClick={startEditingDates}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Edit Booking
                    </button>
                </div>
                
                {editingBooking ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Site
                        </label>
                        <select
                          value={editingBookingData.roomId}
                          onChange={(e) => handleBookingDateChange('roomId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {localRooms.map(room => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={editingBookingData.status}
                          onChange={(e) => handleBookingDateChange('status', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="not_checked_in">Not Checked In</option>
                          <option value="checked_in">Checked In</option>
                          <option value="checked_out">Checked Out</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={editingBookingData.startDate}
                          onChange={(e) => handleBookingDateChange('startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={editingBookingData.endDate}
                          onChange={(e) => handleBookingDateChange('endDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Booking Total ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingBookingData.totalPrice}
                          onChange={(e) => handleBookingDateChange('totalPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter total amount"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveDateChanges}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEditingDates}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div>
                        <strong>Site:</strong> {selectedBooking.roomId}
                      </div>
                      <div>
                        <strong>Status:</strong> 
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          selectedBooking.checkedOut 
                            ? 'bg-gray-100 text-gray-800'
                            : selectedBooking.checkedIn 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedBooking.checkedOut 
                            ? 'Checked Out' 
                            : selectedBooking.checkedIn 
                              ? 'Checked In' 
                              : 'Not Checked In'
                          }
                        </span>
                      </div>
                      <div>
                        <strong>Booking Total:</strong> ${selectedBooking.totalPrice || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <strong>Booking Dates:</strong> {selectedBooking.start || selectedBooking.startDate} - {selectedBooking.end || selectedBooking.endDate}
                      </div>
                      <div>
                        <strong>Check In:</strong> 
                        <span className={`ml-2 ${selectedBooking.checkInDate ? 'text-black' : 'text-gray-500'}`}>
                          {selectedBooking.checkInDate 
                            ? `${selectedBooking.checkInDate}${selectedBooking.checkInTime ? ` at ${selectedBooking.checkInTime}` : ''}`
                            : 'Not Checked In'}
                        </span>
                      </div>
                      <div>
                        <strong>Check Out:</strong> 
                        <span className={`ml-2 ${selectedBooking.checkOutDate ? 'text-black' : 'text-gray-500'}`}>
                          {selectedBooking.checkOutDate 
                            ? `${selectedBooking.checkOutDate}${selectedBooking.checkOutTime ? ` at ${selectedBooking.checkOutTime}` : ''}`
                            : 'Not Checked Out'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-end mb-4">
                  <button
                    onClick={openCustomerEditPopup}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Edit Customer
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Name:</strong> {selectedBooking.guestName || 'Not provided'}
                  </div>
                  <div>
                    <strong>Phone:</strong> {selectedBooking.phone || 'Not provided'}
                  </div>
                  <div>
                    <strong>Email:</strong> {selectedBooking.email || 'Not provided'}
                  </div>
                  <div>
                    <strong>Notes:</strong> {selectedBooking.notes || 'None'}
                  </div>
                </div>
              </div>

              {/* Custom Pricing - Only show if custom pricing is applied */}
              {selectedBooking.customPricing && (
                <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Custom Pricing</h3>
                    <button
                      onClick={openCustomPricingEditPopup}
                      className="px-3 py-1 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    >
                      Edit Pricing
                    </button>
                    </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Status:</strong> 
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        selectedBooking.customPricing ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedBooking.customPricing ? 'Custom Pricing Active' : 'Standard Pricing'}
                      </span>
                  </div>
                    <div>
                      <strong>Custom Price:</strong> 
                      {selectedBooking.customPricing ? `$${selectedBooking.customPrice || 0}` : 'N/A'}
                    </div>
                    <div>
                      <strong>Standard Price:</strong> ${calculateBookingTotal(selectedBooking)}
                    </div>
                    <div>
                      <strong>Current Total:</strong> ${selectedBooking.totalPrice || 0}
                    </div>
                  </div>
                </div>
              )}

              {/* Power Meter Reading */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Power Meter Reading</h3>
                  <button
                    onClick={openPowerMeterReadingPopup}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Enter Reading
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Electricity Used: </strong> 
                    {selectedBooking.electricityUsed ? `${selectedBooking.electricityUsed} kWh` : 'Not recorded'}
                  </div>
                  <div>
                    <strong>Electricity Cost: </strong> 
                    {selectedBooking.electricityCost ? `$${selectedBooking.electricityCost.toFixed(2)}` : '$0.00'}
                  </div>
                  <div>
                    <strong>Pensioner: </strong> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      selectedBooking.pensioner ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBooking.pensioner ? 'Yes (10% discount applied)' : 'No'}
                    </span>
                  </div>
                  <div>
                    <strong>Rate:</strong> ${ELECTRICITY_RATE}/kWh
                  </div>
                </div>
              </div>


              {/* Payment History */}
              <div className={`mb-6 p-4 rounded-lg ${
                selectedBooking ? (() => {
                  const totals = calculateBookingTotals(selectedBooking);
                  if (totals.netAmount < 0) return 'bg-blue-50'; // Overpaid
                  if (totals.netAmount === 0) return 'bg-green-50'; // Fully paid
                  return 'bg-yellow-50'; // Underpaid
                })() : 'bg-green-50'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Payment History</h3>
                  {selectedBooking && (() => {
                    const totals = calculateBookingTotals(selectedBooking);
                    const isFullyPaid = totals.netAmount === 0;
                    const isOverpaid = totals.netAmount < 0;
                    const isPartiallyPaid = totals.netAmount > 0 && totals.totalPaid > 0;
                    
                    return (
                      <div className="text-right">
                        <div className="text-sm text-gray-600">
                          Booking Total: <span className="font-medium">${selectedBooking.totalAmount?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className={`text-sm font-medium ${
                          isFullyPaid ? 'text-green-600' :
                          isOverpaid ? 'text-blue-600' :
                          isPartiallyPaid ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {isFullyPaid ? '✅ Fully Paid' :
                           isOverpaid ? `💰 Overpaid by $${Math.abs(totals.netAmount).toFixed(2)}` :
                           isPartiallyPaid ? `⚠️ Outstanding: $${totals.netAmount.toFixed(2)}` :
                           '❌ No Payments'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <div className="space-y-3">
                  {paymentHistory && paymentHistory.length > 0 ? (
                    (() => {
                      let runningBalance = 0;
                      return paymentHistory.map((payment, index) => {
                        runningBalance += payment.amount;
                        const isRefund = payment.paymentType === 'refund';
                        const isDeposit = payment.paymentType === 'deposit';
                        
                        return (
                          <div key={payment.id} className={`p-3 rounded-lg border ${
                            isRefund ? 'bg-red-50 border-red-200' : 
                            isDeposit ? 'bg-blue-50 border-blue-200' : 
                            'bg-white border-gray-200'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-lg font-semibold ${
                                    isRefund ? 'text-red-700' : 
                                    isDeposit ? 'text-blue-700' : 
                                    'text-green-700'
                                  }`}>
                                    {payment.amount < 0 ? '-' : '+'}${Math.abs(payment.amount).toFixed(2)}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    isRefund ? 'bg-red-200 text-red-800' :
                                    isDeposit ? 'bg-blue-200 text-blue-800' :
                                    'bg-green-200 text-green-800'
                                  }`}>
                                    {payment.paymentType?.toUpperCase() || 'PAYMENT'}
                                  </span>
                                </div>
                                
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>
                                    <span className="font-medium">Method:</span> {payment.paymentMethodName || 'Unknown'}
                                  </div>
                                  {payment.reason && (
                                    <div>
                                      <span className="font-medium">Reason:</span> {payment.reason}
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Date:</span> {new Date(payment.processedAt).toLocaleDateString('en-AU', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  {payment.processedBy && (
                                    <div>
                                      <span className="font-medium">Processed by:</span> {payment.processedBy}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-right ml-4">
                                <div className="text-sm text-gray-500 mb-1">Running Balance</div>
                                <div className={`text-lg font-semibold ${
                                  runningBalance >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  ${runningBalance.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-4xl mb-2">💳</div>
                      <div className="text-gray-500 text-lg font-medium mb-1">No payments recorded yet</div>
                      <div className="text-gray-400 text-sm">Payments will appear here once they are added</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={toggleCheckIn}
                    className={`px-4 py-2 rounded-md text-white ${
                      selectedBooking.checkedOut
                        ? 'bg-gray-500 cursor-not-allowed'
                        : selectedBooking.checkedIn 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-green-600 hover:bg-green-700'
                    }`}
                    disabled={selectedBooking.checkedOut}
                  >
                    {selectedBooking.checkedOut 
                      ? 'Checked Out' 
                      : selectedBooking.checkedIn 
                        ? 'Check Out' 
                        : 'Check In'
                    }
                  </button>
                  <button
                    onClick={() => setPaymentDialogOpen(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    Add Payment
                  </button>
                  <button
                    onClick={() => validateAllFields(() => printInvoice(selectedBooking))}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Print Invoice
                  </button>
                  </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => validateAllFields(() => setDeleteBookingDialog(selectedBooking))}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete Booking
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setBookingDetailsOpen(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {paymentDialogOpen && (
        <div className="fixed inset-0 z-[9000] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Add Payment</h2>
                <button 
                  onClick={() => setPaymentDialogOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              {/* Payment Amount */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Payment Amount
                  </label>
                  <label className="flex items-center">
                      <input
                        type="checkbox"
                      checked={isRefund}
                      onChange={(e) => setIsRefund(e.target.checked)}
                        className="mr-2"
                      />
                    <span className="text-sm text-red-600 font-medium">Refund</span>
                    </label>
                  </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentAmount}
                        onChange={(e) => {
                          const limitedValue = limitToTwoDecimals(e.target.value);
                          setPaymentAmount(limitedValue);
                        }}
                  placeholder="Enter amount"
                  className={`w-full text-2xl font-bold text-center mb-4 p-4 rounded-lg border-2 border-transparent focus:outline-none ${
                    isRefund 
                      ? 'bg-red-50 focus:border-red-500 text-red-700' 
                      : 'bg-gray-50 focus:border-blue-500'
                  }`}
                />
                
                {/* Quick Add Buttons */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                      <button
                    onClick={() => addToPaymentAmount(5)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                  >
                    +$5
                  </button>
                  <button
                    onClick={() => addToPaymentAmount(10)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                  >
                    +$10
                  </button>
                  <button
                    onClick={() => addToPaymentAmount(20)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                  >
                    +$20
                  </button>
                  <button
                    onClick={() => addToPaymentAmount(50)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                      >
                        +$50
                      </button>
                      <button
                    onClick={() => addToPaymentAmount(100)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                      >
                        +$100
                      </button>
                  <button
                    onClick={() => setPaymentAmount(0)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Clear
                      </button>
                    </div>
                  </div>
              
              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <label key={method.id} className="flex items-center">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mr-2"
                      />
                      {method.name}
                    </label>
                  ))}
                  {!paymentMethod && (
                    <p className="text-sm text-red-600 mt-2">Please select a payment method</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                  <button
                  onClick={() => setPaymentDialogOpen(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                  onClick={addPaymentToBooking}
                  disabled={paymentAmount <= 0 || !paymentMethod}
                  className={`px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRefund 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isRefund ? 'Process Refund' : 'Add Payment'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Booking Conflict Dialog */}
      {existingBookingDialog && (
        <div className="fixed inset-0 z-[9000] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-red-600">Booking Conflict</h2>
                <button 
                  onClick={() => setExistingBookingDialog(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  {existingBookingDialog.isDateEdit 
                    ? 'The selected dates conflict with an existing booking.'
                    : 'There is already a booking starting on this date.'
                  }
                </p>
                
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-medium text-red-800 mb-2">Existing Booking Details:</h3>
                  <div className="text-sm text-red-700 space-y-1">
                    <div><strong>Guest Name:</strong> {existingBookingDialog.booking.guestName || 'Not specified'}</div>
                    <div><strong>Room:</strong> {existingBookingDialog.roomId}</div>
                    <div><strong>Start Date:</strong> {existingBookingDialog.booking.startDate}</div>
                    <div><strong>End Date:</strong> {existingBookingDialog.booking.endDate}</div>
                  </div>
                  
                  {existingBookingDialog.isDateEdit && (
                    <div className="mt-3 pt-3 border-t border-red-300">
                      <h4 className="font-medium text-red-800 mb-1">Your Selected Dates:</h4>
                      <div className="text-sm text-red-700">
                        <div><strong>Start Date:</strong> {existingBookingDialog.newStartDate}</div>
                        <div><strong>End Date:</strong> {existingBookingDialog.newEndDate}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setExistingBookingDialog(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROOMS EDITOR */}
      <Dialog open={roomsOpen} onOpenChange={setRoomsOpen}>
        <DialogContent className="max-w-6xl z-[220]">
          <DialogHeader><DialogTitle>Manage Sites & Pricing</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto p-1">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="font-medium mb-2">Type default rates</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {(['powered','cabin','permanent']).map((t)=> (
                  <div key={t} className="border rounded-lg p-3 bg-white">
                    <div className="capitalize font-medium mb-2">{t}</div>
                    <div className="flex gap-4">
                      <div className="flex-1"><label className="text-xs text-slate-500 mb-1 block">Nightly</label><Input type="number" step="0.01" min="0" value={typeRates[t].nightly} onChange={(e)=>setTypeRates(prev=>({...prev,[t]:{...prev[t], nightly:+e.target.value}}))} className="!h-8 !text-sm w-full" /></div>
                      <div className="flex-1"><label className="text-xs text-slate-500 mb-1 block">Weekly</label><Input type="number" step="0.01" min="0" value={typeRates[t].weekly} onChange={(e)=>setTypeRates(prev=>({...prev,[t]:{...prev[t], weekly:+e.target.value}}))} className="!h-8 !text-sm w-full" /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2"><Button size="sm" variant="outline" onClick={applyTypeRatesToRooms}>Apply to all rooms of each type</Button></div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Order</th>
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Nightly Rate</th>
                  <th className="p-2 text-left">Weekly Rate</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomsDraft.map((r, idx) => (
                  <React.Fragment key={idx}>
                    {/* Drop indicator line */}
                    {dragOverIndex === idx && draggedRoomIndex !== null && draggedRoomIndex !== idx && (
                      <tr>
                        <td colSpan="6" className="h-1 bg-blue-500 border-0 p-0">
                          <div className="h-1 bg-blue-500 w-full"></div>
                        </td>
                      </tr>
                    )}
                    
                    <tr 
                      className={`border-b hover:bg-slate-50 transition-colors ${
                        draggedRoomIndex === idx ? 'opacity-50 bg-blue-50' : ''
                      } ${
                        dragOverIndex === idx && draggedRoomIndex !== null && draggedRoomIndex !== idx 
                          ? 'bg-blue-50 border-blue-300' 
                          : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleRoomDragStart(e, idx)}
                      onDragEnd={handleRoomDragEnd}
                      onDragOver={(e) => handleRoomDragOver(e, idx)}
                      onDragLeave={handleRoomDragLeave}
                      onDrop={(e) => handleRoomDrop(e, idx)}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-gray-500 font-mono w-6 text-center">
                            {idx + 1}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button 
                              className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30" 
                              onClick={()=>moveRoomUp(idx)} 
                              disabled={idx === 0} 
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button 
                              className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30" 
                              onClick={()=>moveRoomDown(idx)} 
                              disabled={idx === roomsDraft.length - 1} 
                              title="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          <div className="text-xs text-gray-400 ml-1" title="Drag to reorder">
                            ⋮⋮
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <Input 
                          value={r.id} 
                          onChange={(e)=>updateRoomDraft(idx,{id:e.target.value, name:e.target.value})} 
                          className="h-8 text-sm w-24" 
                          placeholder="Room ID"
                          title="Room ID (must be unique)"
                        />
                      </td>
                      <td className="p-2">
                        <Select value={r.type||'powered'} onValueChange={(v)=>updateRoomDraft(idx,{type:v})}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="powered">⚡ Powered</SelectItem>
                            <SelectItem value="cabin">🏠 Cabin</SelectItem>
                            <SelectItem value="permanent">🏡 Permanent</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          value={r.nightlyRate||0} 
                          onChange={(e)=>updateRoomDraft(idx,{nightlyRate:+e.target.value})} 
                          className="h-8 text-sm w-20" 
                          title="Nightly rate in dollars"
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          value={r.weeklyRate||0} 
                          onChange={(e)=>updateRoomDraft(idx,{weeklyRate:+e.target.value})} 
                          className="h-8 text-sm w-20" 
                          title="Weekly rate in dollars"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={()=>setDeleteRoomConfirm(idx)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                
                {/* Drop indicator at the end */}
                {dragOverIndex === roomsDraft.length && draggedRoomIndex !== null && (
                  <tr>
                    <td colSpan="6" className="h-1 bg-blue-500 border-0 p-0">
                      <div className="h-1 bg-blue-500 w-full"></div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Drop zone at the end of the table */}
            <div 
              className={`h-8 border-2 border-dashed rounded transition-colors ${
                dragOverIndex === roomsDraft.length && draggedRoomIndex !== null
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-transparent'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverIndex(roomsDraft.length);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => handleRoomDrop(e, roomsDraft.length)}
            >
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {dragOverIndex === roomsDraft.length && draggedRoomIndex !== null
                  ? 'Drop here to move to end'
                  : 'Drop zone'
                }
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={addRoomDraft} className="bg-green-600 hover:bg-green-700">
                + Add Site
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const newRooms = roomsDraft.map((room, index) => ({
                    ...room,
                    id: `${room.type.charAt(0).toUpperCase()}${index + 1}`,
                    name: `${room.type.charAt(0).toUpperCase()}${index + 1}`
                  }));
                  setRoomsDraft(newRooms);
                }}
                title="Auto-generate room IDs based on type and order"
              >
                Auto-ID
              </Button>
              <div className="text-sm text-gray-500 ml-2">
                {roomsDraft.length} rooms total
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRoomsOpen(false)}>Cancel</Button>
            <Button onClick={saveRooms}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE ROOM CONFIRMATION DIALOG */}
      <Dialog open={deleteRoomConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteRoomConfirm(null); }}>
        <DialogContent className="max-w-md z-[10000]">
          <DialogHeader><DialogTitle>⚠️ Delete Site</DialogTitle></DialogHeader>
          <div className="mt-4 text-sm text-slate-600">
            {deleteRoomConfirm !== null && (() => {
              const room = roomsDraft[deleteRoomConfirm];
              if (!room) return null;
              
              // Check if room has any bookings
              const hasBookings = bookings.some(booking => booking.roomId === room.id);
              
              return (
                <>
                  <div className="mb-3">
                    Are you sure you want to delete site <strong>{room.id}</strong>?
                  </div>
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium mb-2">Site Details:</div>
                    <div>Type: <span className="capitalize">{room.type}</span></div>
                    <div>Rates: ${room.nightlyRate || 0} nightly, ${room.weeklyRate || 0} weekly</div>
                    <div>Last Reading: {room.lastReading || 0}</div>
                  </div>
                  {hasBookings && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-yellow-800 font-medium">⚠️ Warning:</div>
                      <div className="text-yellow-700">
                        This site has existing bookings. Deleting it may cause issues with those bookings.
                      </div>
                    </div>
                  )}
                  <div className="text-slate-500">
                    This action cannot be undone.
                  </div>
                </>
              );
            })()}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setDeleteRoomConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={()=>{
              if (deleteRoomConfirm !== null) {
                removeRoomDraft(deleteRoomConfirm);
                setDeleteRoomConfirm(null);
                toast.success('Site deleted');
              }
            }}>Delete Site</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE BOOKING CONFIRMATION DIALOG */}
      <Dialog open={deleteBookingDialog !== null} onOpenChange={(open) => { if (!open) setDeleteBookingDialog(null); }}>
        <DialogContent className="max-w-md z-[10000]">
          <DialogHeader><DialogTitle>⚠️ Delete Booking</DialogTitle></DialogHeader>
          <div className="mt-4 text-sm text-slate-600">
            {deleteBookingDialog && (
              <>
                <div className="mb-3">
                  Are you sure you want to delete this booking?
                </div>
                <div className="mb-3">
                  <strong>Client:</strong> {deleteBookingDialog.name || deleteBookingDialog.guest || 'Unknown'}
                </div>
                <div className="mb-3">
                  <strong>Site:</strong> {deleteBookingDialog.roomId}
                </div>
                <div className="mb-3">
                  <strong>Dates:</strong> {deleteBookingDialog.start} to {deleteBookingDialog.end}
                </div>
                <div className="text-red-600 font-medium">
                  This action cannot be undone.
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteBookingDialog(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                deleteBooking();
                setDeleteBookingDialog(null);
              }}
            >
              Delete Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION SUCCESS DIALOG */}
      <Dialog open={deleteConfirmationDialog !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmationDialog(null); }}>
        <DialogContent className="max-w-md z-[10000]">
          <DialogHeader><DialogTitle>✅ Booking Deleted</DialogTitle></DialogHeader>
          <div className="mt-4 text-sm text-slate-600">
            {deleteConfirmationDialog && (
              <>
                <div className="mb-3">
                  The booking has been successfully deleted.
                </div>
                <div className="mb-3">
                  <strong>Client:</strong> {deleteConfirmationDialog.clientName}
                </div>
                <div className="mb-3">
                  <strong>Site:</strong> {deleteConfirmationDialog.site}
                </div>
                <div className="mb-3">
                  <strong>Booking:</strong> {deleteConfirmationDialog.dates}
                </div>
                <div className="text-green-600 font-medium">
                  This dialog will close automatically in a few seconds.
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setDeleteConfirmationDialog(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Edit Popup */}
      {customerEditPopupOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              validateAllFields(() => setCustomerEditPopupOpen(false));
            }
          }}
          tabIndex={0}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Edit Customer Information</h2>
                <button 
                  onClick={cancelCustomerEdit}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                      <input
                        type="text"
                        value={editingCustomerData.name}
                        onChange={(e) => {
                          setEditingCustomerData(prev => ({ ...prev, name: e.target.value }));
                          // No validation while typing - only on explicit actions
                        }}
                        onBlur={() => {
                          // Validate when clicking elsewhere
                          validateField('name', editingCustomerData.name);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            // Validate when hitting Enter or Tab
                            validateField('name', editingCustomerData.name);
                          }
                        }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone *
                    </label>
                      <input
                        type="tel"
                        value={editingCustomerData.phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingCustomerData(prev => ({ ...prev, phone: fmtPhoneAUInput(val) }));
                        // No validation while typing - only on explicit actions
                      }}
                      onBlur={() => {
                        // Validate when clicking elsewhere
                        validateField('phone', editingCustomerData.phone);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          // Validate when hitting Enter or Tab
                          validateField('phone', editingCustomerData.phone);
                        }
                        }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                      <input
                        type="email"
                        value={editingCustomerData.email}
                        onChange={(e) => {
                          setEditingCustomerData(prev => ({ ...prev, email: e.target.value }));
                          // No validation while typing - only on explicit actions
                        }}
                        onBlur={() => {
                          // Validate when clicking elsewhere
                          validateField('email', editingCustomerData.email);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            // Validate when hitting Enter or Tab
                            validateField('email', editingCustomerData.email);
                          }
                        }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                    <textarea
                      value={editingCustomerData.notes}
                      onChange={(e) => setEditingCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    placeholder="Add any notes about this booking..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={cancelCustomerEdit}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => validateAllFields(() => setCustomerEditPopupOpen(false))}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Edit Popup */}
      {dateEditPopupOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center"
          tabIndex={0}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Edit Booking Dates</h2>
                <button 
                  onClick={() => setDateEditPopupOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                    </label>
                      <input
                    type="date"
                    value={editingBookingDates.startDate}
                    onChange={(e) => handleBookingDateChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                    </label>
                      <input
                    type="date"
                    value={editingBookingDates.endDate}
                    onChange={(e) => handleBookingDateChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* Nights Calculation */}
                <div className="p-3 bg-blue-50 rounded-md">
                  <div className="text-sm font-medium text-blue-800">
                    📅 Booking Duration: {calculateNights(editingBookingDates.startDate, editingBookingDates.endDate)} nights
                  </div>
                  {editingBookingDates.startDate && editingBookingDates.endDate && (
                    <div className="text-xs text-blue-600 mt-1">
                      {editingBookingDates.startDate} to {editingBookingDates.endDate}
                    </div>
                  )}
                </div>

                {/* Custom Pricing Warning */}
                {hasCustomPricing() && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm font-medium text-yellow-800 mb-2">
                      ⚠️ Custom Pricing Active
                    </div>
                    <div className="text-xs text-yellow-700">
                      This booking has custom pricing set to ${selectedBooking.customPrice}. 
                      Changing dates will not automatically recalculate the price.
                    </div>
                  </div>
                )}

                {/* Price Impact Warning */}
                {!hasCustomPricing() && editingBookingDates.startDate && editingBookingDates.endDate && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      💰 Price Impact
                    </div>
                    <div className="text-xs text-green-700">
                      Changing dates will automatically recalculate the booking price based on the room's nightly rate.
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                      <button
                  onClick={() => setDateEditPopupOpen(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                  Cancel
                      </button>
                      <button
                  onClick={() => {
                    saveDateChanges();
                    setDateEditPopupOpen(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
      )}

      {/* Custom Pricing Edit Popup */}
      {customPricingEditOpen && selectedBooking && (
        <div 
          className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center"
          tabIndex={0}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Edit Custom Pricing</h2>
                  <button
                  onClick={() => setCustomPricingEditOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                  </button>
                </div>
              
              <div className="space-y-4">
                {/* Custom Pricing Toggle */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="customPricingToggle"
                    checked={editingCustomPricing.customPricing}
                    onChange={(e) => setEditingCustomPricing(prev => ({
                      ...prev,
                      customPricing: e.target.checked,
                      customPrice: e.target.checked ? prev.customPrice : 0
                    }))}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="customPricingToggle" className="text-sm font-medium text-gray-700">
                    Enable custom pricing
                  </label>
                </div>

                {/* Custom Price Input */}
                {editingCustomPricing.customPricing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Price ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingCustomPricing.customPrice}
                      onChange={(e) => setEditingCustomPricing(prev => ({
                        ...prev,
                        customPrice: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter custom price"
                    />
                  </div>
                )}

                {/* Current Pricing Info */}
                <div className="p-3 bg-gray-50 rounded-md">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Pricing</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Standard Price:</strong> ${calculateBookingTotal(selectedBooking)}</div>
                    <div><strong>Current Total:</strong> ${selectedBooking.totalPrice || 0}</div>
                    {editingCustomPricing.customPricing && (
                      <div><strong>New Total:</strong> ${editingCustomPricing.customPrice}</div>
                    )}
                  </div>
                </div>

                {/* Warning for custom pricing */}
                {editingCustomPricing.customPricing && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm text-yellow-800">
                      ⚠️ <strong>Warning:</strong> Custom pricing will override standard room rates. 
                      This price will not change if booking dates are modified.
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                  <button
                  onClick={() => setCustomPricingEditOpen(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                  onClick={saveCustomPricingChanges}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Custom Tooltip */}
      {cellTooltip && (
        <div
          className="fixed z-[200] bg-gray-900 text-white text-sm px-3 py-2 rounded shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-semibold">{cellTooltip.fullDayName}</div>
          <div className="text-gray-300">{cellTooltip.fullDate}</div>
          <div className="text-gray-300">{cellTooltip.siteName}</div>
        </div>
      )}
      {/* Power Meter Reading Popup */}
      <Dialog open={powerMeterReadingOpen} onOpenChange={setPowerMeterReadingOpen}>
        <DialogContent className="max-w-md z-[10000]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Power Meter Reading</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Previous Reading
              </label>
              <input
                type="number"
                value={powerMeterReading.previousReading}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Reading
              </label>
              <input
                type="number"
                value={powerMeterReading.currentReading}
                onChange={(e) => setPowerMeterReading(prev => ({ ...prev, currentReading: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current meter reading"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="pensioner"
                checked={powerMeterReading.isPensioner}
                onChange={(e) => setPowerMeterReading(prev => ({ ...prev, isPensioner: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="pensioner" className="text-sm font-medium text-gray-700">
                Customer is pensioner (10% discount)
              </label>
            </div>
            {powerMeterReading.currentReading > powerMeterReading.previousReading && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm">
                  <strong>Electricity Used:</strong> {powerMeterReading.currentReading - powerMeterReading.previousReading} kWh
                </div>
                <div className="text-sm">
                  <strong>Cost:</strong> ${((powerMeterReading.currentReading - powerMeterReading.previousReading) * ELECTRICITY_RATE * (powerMeterReading.isPensioner ? 0.9 : 1)).toFixed(2)}
                  {powerMeterReading.isPensioner && <span className="text-green-600 ml-1">(10% pensioner discount applied)</span>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPowerMeterReadingOpen(false)}>Cancel</Button>
            <Button onClick={savePowerMeterReading}>Save Reading</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Management Dialog */}
      <Dialog open={clientsOpen} onOpenChange={setClientsOpen}>
        <DialogContent className="max-w-6xl z-[10000]">
          <DialogHeader>
            <DialogTitle>Client Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-medium">
                  {showDeletedClients ? 'Deleted Clients' : 'Active Clients'} ({clients.filter(c => showDeletedClients ? c.isDeleted : !c.isDeleted).length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeletedClients(!showDeletedClients)}
                >
                  {showDeletedClients ? 'Show Active' : 'Show Deleted'}
                </Button>
              </div>
              <Button onClick={() => setClientsOpen(false)}>Close</Button>
              </div>
              
            {clients.filter(c => showDeletedClients ? c.isDeleted : !c.isDeleted).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {showDeletedClients 
                  ? 'No deleted clients found.' 
                  : 'No clients found. Clients will be automatically created when bookings are made.'
                }
                  </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.filter(c => showDeletedClients ? c.isDeleted : !c.isDeleted).map((client) => (
                  <div key={client.id} className={`border rounded-lg p-4 bg-white hover:shadow-md transition-shadow ${client.isDeleted ? 'opacity-60 bg-red-50' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-lg">{client.firstName} {client.lastName}</h4>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openClientHistory(client)}
                        >
                          History
                        </Button>
                        {!client.isDeleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openClientEdit(client)}
                          >
                            Edit
                          </Button>
                        )}
                        {client.isDeleted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreClient(client.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this client? This will preserve their booking history but hide them from active searches.')) {
                                softDeleteClient(client.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {client.phone && <div>📞 {client.phone}</div>}
                      {client.email && <div>✉️ {client.email}</div>}
                      <div>📅 Created: {client.createdDate}</div>
                      <div>📅 Last booking: {client.lastBookingDate}</div>
                      <div>📊 Total bookings: {client.totalBookings}</div>
                      {client.isDeleted && <div className="text-red-600">🗑️ Deleted: {client.deletedDate}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Edit Dialog */}
      <Dialog open={clientEditOpen} onOpenChange={setClientEditOpen}>
        <DialogContent className="max-w-md z-[10000]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={editingClient.firstName}
                  onChange={(e) => setEditingClient(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={editingClient.lastName}
                  onChange={(e) => setEditingClient(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editingClient.phone}
                  onChange={(e) => setEditingClient(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editingClient.email}
                  onChange={(e) => setEditingClient(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                      </div>
                    </div>
                  )}
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={() => {
                if (confirm('Are you sure you want to delete this client? This will preserve their booking history but hide them from active searches.')) {
                  softDeleteClient(editingClient.id);
                }
              }}
            >
              Delete Client
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setClientEditOpen(false)}>Cancel</Button>
              <Button onClick={saveClientEdit}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client History Dialog */}
      <Dialog open={clientHistoryOpen} onOpenChange={setClientHistoryOpen}>
        <DialogContent className="max-w-4xl z-[10000]">
          <DialogHeader>
            <DialogTitle>
              Booking History - {selectedClientForHistory?.firstName} {selectedClientForHistory?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto">
            {selectedClientForHistory && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Total Bookings</div>
                    <div className="text-2xl font-bold">{selectedClientForHistory.totalBookings}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Last Booking</div>
                    <div className="text-lg font-semibold">{selectedClientForHistory.lastBookingDate}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Phone</div>
                    <div className="text-lg">{selectedClientForHistory.phone || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Email</div>
                    <div className="text-lg">{selectedClientForHistory.email || 'N/A'}</div>
                </div>
              </div>
              
                <div>
                  <h3 className="text-lg font-medium mb-3">Booking History</h3>
                  {selectedClientForHistory.bookingHistory && selectedClientForHistory.bookingHistory.length > 0 ? (
                    <div className="space-y-2">
                      {selectedClientForHistory.bookingHistory
                        .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
                        .map((booking, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">Room {booking.roomId}</div>
                              <div className="text-sm text-gray-600">
                                {booking.startDateDate} - {booking.endDateDate}
              </div>
                              <div className="text-sm text-gray-500">
                                Booked on: {booking.bookingDate}
            </div>
          </div>
                            <div className="text-right">
                              <div className="font-semibold">${booking.totalAmount}</div>
                              <div className={`text-sm px-2 py-1 rounded ${
                                booking.status === 'checked-in' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {booking.status === 'checked-in' ? 'Checked In' : 'Upcoming'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No booking history found for this client.
        </div>
      )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Import/Export Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Data Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-md font-medium mb-2">Export Data</h4>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={exportData}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export JSON Backup
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={exportToCSV}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV Reports
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-md font-medium mb-2">Import Data</h4>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={importClick}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import JSON Backup
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Import previously exported JSON backup files
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Methods Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
              
              {/* Add New Payment Method */}
              <div className="mb-4">
                <h4 className="text-md font-medium mb-2">Add New Payment Method</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter payment method name"
                    value={newPaymentMethodName}
                    onChange={(e) => setNewPaymentMethodName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addPaymentMethod();
                      }
                    }}
                  />
                  <Button onClick={addPaymentMethod}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add
                  </Button>
                </div>
              </div>

              {/* Existing Payment Methods */}
              <div>
                <h4 className="text-md font-medium mb-2">Current Payment Methods</h4>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center">
                        {editingPaymentMethod === method.id ? (
                          <Input
                            defaultValue={method.name}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                updatePaymentMethod(method.id, e.target.value);
                              }
                              if (e.key === 'Escape') {
                                setEditingPaymentMethod(null);
                              }
                            }}
                            onBlur={(e) => updatePaymentMethod(method.id, e.target.value)}
                            autoFocus
                            className="w-48"
                          />
                        ) : (
                          <>
                            <span className="font-medium">{method.name}</span>
                            {method.isDefault && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                Default
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {editingPaymentMethod === method.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPaymentMethod(null)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <>
                            {method.id !== 'cash' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingPaymentMethod(method.id)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removePaymentMethod(method.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The "Cash" payment method is the default and cannot be removed or renamed. 
                  All newly created payment methods will be available when creating bookings or recording payments.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Ledger Dialog */}
      <Dialog open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <DialogContent className="w-full max-w-7xl max-h-[90vh] overflow-y-auto">
          <PaymentLedger 
            paymentMethods={paymentMethods} 
            onClose={() => setPaymentsOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Refund Warning Dialog */}
      <Dialog open={refundWarningOpen} onOpenChange={setRefundWarningOpen}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Refund Warning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> The refund amount (${Math.abs(refundAmount).toFixed(2)}) is greater than the amount paid for this booking.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Refund Amount</label>
              <Input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <Select
                value={refundPaymentMethodId}
                onValueChange={setRefundPaymentMethodId}
              >
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <Input
                placeholder="e.g., Service Issue, Cancellation"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="refund-acknowledge"
                checked={refundAcknowledged}
                onChange={(e) => setRefundAcknowledged(e.target.checked)}
              />
              <label htmlFor="refund-acknowledge" className="text-sm">
                I acknowledge and agree that the refund amount is greater than the amount paid for this booking
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRefundWarningOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={processRefund} disabled={!refundAcknowledged}>
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default App;