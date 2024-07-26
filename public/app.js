/* eslint-disable prettier/prettier */
// app.js
lastMinute = 0;
var layout = {
  title: 'Live Candlestick Chart',
  xaxis: {
    type: 'date',
    rangeslider: { visible: false }
  },
  yaxis: {
    title: 'Price',
    tickformat: '.2f',
    side: 'right',
  }
};

// For buy signals
var scatterTraceBuy = {
  x: [],
  y: [],
  mode: 'markers',
  marker: {
    symbol: 'triangle-up',
    size: 10,
    color: 'green'
  },
  type: 'scatter',
  name: 'Buy Signals'
};

// For sell  signals
var scatterTraceSell = {
  x: [],
  y: [],
  mode: 'markers',
  marker: {
    symbol: 'triangle-down',
    size: 10,
    color: 'red'
  },
  type: 'scatter',
  name: 'Sell Signals'
};

var candlestickTrace = {
  type: 'candlestick',
  x: [],
  close: [],
  open: [],
  high: [],
  low: [],
  increasing: { line: { color: 'green' } },
  decreasing: { line: { color: 'red' } },
  line: { width: 1 }
};

// Separate trace for the latest live candle
var liveCandleTrace = {
  type: 'candlestick',
  x: [],
  close: [],
  open: [],
  high: [],
  low: [],
  increasing: { line: { color: 'green' } },
  decreasing: { line: { color: 'red' } },
  line: { width: 1 }
};

function updateChart(newData) {
  const time = new Date(newData.t);

  // Add new data to the candlestick trace
  if (candlestickTrace.x.length === 0 || time.getTime() !== new Date(candlestickTrace.x[candlestickTrace.x.length - 1]).getTime()) {
    // If there is no data or the new data is from a new time period, push to candlestickTrace
    candlestickTrace.x.push(time);
    candlestickTrace.open.push(newData.o);
    candlestickTrace.high.push(newData.h);
    candlestickTrace.low.push(newData.l);
    candlestickTrace.close.push(newData.c);
  } else {
    // Otherwise, update the last entry
    candlestickTrace.high[candlestickTrace.high.length - 1] = Math.max(candlestickTrace.high[candlestickTrace.high.length - 1], newData.h);
    candlestickTrace.low[candlestickTrace.low.length - 1] = Math.min(candlestickTrace.low[candlestickTrace.low.length - 1], newData.l);
    candlestickTrace.close[candlestickTrace.close.length - 1] = newData.c;
  }

  // Update the live candle trace with the latest data
  liveCandleTrace.x = [time];
  liveCandleTrace.open = [newData.o];
  liveCandleTrace.high = [newData.h];
  liveCandleTrace.low = [newData.l];
  liveCandleTrace.close = [newData.c];

  // Determine the fill color for the latest data
  const fillColor = newData.c > newData.o ? 'green' : 'red';
  liveCandleTrace.increasing.line.color = fillColor;
  liveCandleTrace.decreasing.line.color = fillColor;

  // Redraw the updated candlestick chart
  Plotly.react('candlestickChart', [candlestickTrace, liveCandleTrace, scatterTraceBuy, scatterTraceSell], layout);
}

class Dropdown {
  constructor(dropdownId) {
    this.dropdown = document.getElementById(dropdownId);
    this.signals = new Set();
    this.initDropdownListener();
  }

  initDropdownListener() {
    this.dropdown.addEventListener('change', (event) => {
      const selectedSignalText = event.target.value;
      console.log('Selected Signal Text:', selectedSignalText);
      const selectedSignal = this.parseSignal(selectedSignalText);
      console.log('Selected Signal:', selectedSignal); // Debugging output
      this.displaySelectedSignal(selectedSignal);
    });
  }

  update(signal) {
    const signalText = `${signal.signal} at ${signal.open_time} - Price: ${signal.signal === 'Buy' ? signal.low : signal.high}`;

    // Check for duplicates
    if (this.signals.has(signalText)) return;

    // Add to the set
    this.signals.add(signalText);

    // Add the signal to the dropdown
    const option = document.createElement('option');
    option.value = signalText;
    option.text = signalText;
    this.dropdown.appendChild(option);
  }

  parseSignal(signalText) {
    console.log('Parsing signal:', signalText);

    const parts = signalText.split(' - Price: ');
    if (parts.length === 2) {
      const signalPart = parts[0].split(' at ');
      const signalType = signalPart[0];
      const openTime = signalPart[1];
      const price = parseFloat(parts[1]);

      return {
        signal: signalType,
        open_time: openTime,
        price: price
      };
    }

    console.log('No match found for signal text:', signalText);
    return null;
  }

  displaySelectedSignal(signal) {
    if (signal) {
      // Scroll the chart to the selected signal
      const selectedTime = new Date(signal.open_time).getTime();
      const layoutUpdate = {
        xaxis: {
          range: [
            new Date(selectedTime - 1 * 60 * 1000), // 1 minutes before
            new Date(selectedTime + 1 * 60 * 1000) // 1 minutes after
          ],
          rangeslider: { visible: false }
        }
      };
      console.log('Updating layout to focus on:', new Date(signal.open_time));
      Plotly.relayout('candlestickChart', layoutUpdate);
    }
  }
}

// Create an instance of the Dropdown class
const signalDropdown = new Dropdown('signalDropdown');


// For processSupertrendSignals
function processSupertrendSignals(newSignals) {
  newSignals.forEach(signal => {
    var time = new Date(signal.open_time);
    var price = signal.signal === 'Buy' ? signal.low : signal.high;

    if (signal.signal === 'Buy') {
      scatterTraceBuy.x.push(time);
      scatterTraceBuy.y.push(price);
    } else if (signal.signal === 'Sell') {
      scatterTraceSell.x.push(time);
      scatterTraceSell.y.push(price);
    }
    // Update the dropdown list
    signalDropdown.update(signal);

  });

  Plotly.newPlot('candlestickChart', [candlestickTrace, liveCandleTrace, scatterTraceBuy, scatterTraceSell], layout);
}


var socket = io(); // Connect to WebSocket

// Get candlestrick data socket
socket.on('candlestickData', function(newData) {
    console.log(newData);
  updateChart(newData);
});

// Get liveprice socket
socket.on('livePrice', function(newPrice){
  console.log(newPrice);
  //updateChart(newPrice);
});

// Get signal socket
socket.on('signals', function(newSignal) {
  console.log(newSignal);
  processSupertrendSignals(newSignal);
});

// Get signal socket
socket.on('newCandle', function(newCandle) {
  console.log(newCandle);
});
