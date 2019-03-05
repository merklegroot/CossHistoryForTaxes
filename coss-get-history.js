// Please check out the README before running.
// This script is meant to be run directly on the website.
// It is not an API script.

var allCanon = [];

var lodashUrl = "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js";
var momentUrl = "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js";

// as of 2019-03-04.
// Fees in the resulting spreadsheet are based on the assumption that the fees haven't changed.
// That's not necessarily accurate. Getting a more accurate value would invole determining what the fee
// was at the time the withdrawal took place.
var withdrawalFees = {"XEM":"13","ZEN":"0.14","VET":"0.6","ADI":"1100","WTC":"0.8","ITT":"120","BNT":"1.4","LALA":"300","PAY":"3","USDT":"1","NPXSXEM":"2100","DASH":"0.01","TRAK":"110","WISH":"40","VZT":"60","OPQ":"5","WAVES":"0.7","PRIX":"1.6","XNK":"110","STX":"60","XRP":"0.2","NPXS":"1500","TRX":"1","BWT":"70","GUSD":"1","SENC":"310","SUB":"18","EUR":"0","LSK":"0.7","BCH":"0.006","POE":"180","OMG":"0.6","BTC":"0.00023","CAN":"40","CVC":"15","KIN":"30000","SURE":"2100","HGT":"270","PASS":"300","TUSD":"1","NOX":"600","USDC":"1","ARK":"2.3","LTC":"0.029","GAT":"600","PGT":"4","IND":"80","ENJ":"40","KNC":"5","FXT":"300","MRK":"160","CFT":"10","BLZ":"15","CRED":"40","COSS":"17","SNM":"30","GBP":"0","UBC":"500","XLM":"0.01","LINK":"2.9","FYN":"4","FDX":"110","QTUM":"0.5","UFR":"22","XDCE":"600","USD":"0","EOS":"0.3","CS":"10","MORE":"8","TIG":"29","LA":"19","DAT":"900","JET":"80","LAN":"2300","ETH":"0.008","PRSN":"60","NEO":"0","KAYA":"10","PIX":"200","REQ":"40","ICX":"4"};

// https://www.sitepoint.com/dynamically-load-jquery-library-javascript/
function loadScript(url, callback) {
    var script = document.createElement("script")
    script.type = "text/javascript";

    if (script.readyState) {
        script.onreadystatechange = function () {
            if (script.readyState == "loaded" || script.readyState == "complete") {
                script.onreadystatechange = null;
                if(callback) { callback(); }
            }
        };
    } else {
        script.onload = function () {
            if(callback) { callback(); }
        };
    }

    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
}

var loadAllHistory = function () {
    var addDays = function(date, daysToAdd) {
        return new Date(date.getTime() + daysToAdd * 86400000);
    };

    var ajax = function (url, verb, payload, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            var DONE = 4;
            var OK = 200;

            if (xhr.readyState !== DONE) { return; }
            if (xhr.status === OK) {
                callback(xhr.responseText);
                return;
            }
            
            console.log('Error: ' + xhr.status);
        };

        xhr.open(verb ? verb : "GET", url);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(payload);
    };

    var allCanonToCsv = function (allCanon) {
        var columns = "Id, Time Stamp, Type, Base Symbol, Quote Symbol, Price, Quantity, Total, , Fee, , Order Id, Transaction Id, From Address, ToAddress";
        var resultText = "";

        resultText += columns + "\r\n";
        for (var i = 0; i < allCanon.length; i++) {
            var item = allCanon[i];
            var orderMoment = moment(item.timeStamp);
            var dateText = orderMoment.format("YYYY-MM-DD HH:mm:ss");

            rowText = item.id + ", "
                + dateText + ", " 
                + item.type + ", "
                + (item.baseSymbol || "") + ", " 
                + (item.quoteSymbol || "") + ", "                
                + (item.price || "") + ", "
                + (item.quantity || "") + ", "
                + (item.totalQuantity || "") + ", "
                + (item.totalSymbol || "") + ", "
                + (item.feeQuantity || "") + ", "
                + (item.feeSymbol || "") + ", "
                + (item.orderId || "") + ", "
                + (item.transactionId || "") + ", "
                + (item.fromAddress || "") + ", "
                + (item.toAddress || "") + ", ";

            resultText += rowText + "\r\n";
        }

        return resultText;
    };

    // https://stackoverflow.com/questions/24898044/is-possible-to-save-javascript-variable-as-file
    var downloadCsv = function (contents, flleName) {
        var hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:attachment/text,' + encodeURI(contents);
        hiddenElement.target = '_blank';
        hiddenElement.download = flleName;
        hiddenElement.click();
    }

    var parseTradingPair = function (tradingSymbol) {        
        var pieces = tradingSymbol ? tradingSymbol.split("_") : null;
        return {
            baseSymbol: pieces && pieces.length >= 1 ? pieces[0] : null,
            quoteSymbol: pieces && pieces.length >= 2 ? pieces[1] : null
        };
    }

    var parseQuantityAndSymbol = function (text) {
        if(text === undefined || text === null) { return {}; }
        var trimmedText = text.trim();
        var pieces = trimmedText.split(' ');
        return {
            quantity: pieces && pieces.length >= 1 ? pieces[0].trim() : null,
            symbol: pieces && pieces.length >= 2 ? pieces[1].trim() : null
        };
    }

    var onAllTradesReady = function () {
        allCanon = [];
        for (var i = 0; i < allTrades.length; i++) {
          var item = allTrades[i];
          var tradingPair = parseTradingPair(item.symbol);
          var fee = parseQuantityAndSymbol(item.fee);
          var total = parseQuantityAndSymbol(item.total);

          var canon = {
            category: "trade",
            id: item.hex_id,	    
            orderId: item.order_id,	  
            type: item.order_side,
            baseSymbol: tradingPair.baseSymbol,
            quoteSymbol: tradingPair.quoteSymbol,
            price: item.price,
            quantity: item.quantity,
            feeQuantity: fee.quantity,
            feeSymbol: fee.symbol,
            additionalFee: item.additional_fee,
            totalQuantity: total.quantity,
            totalSymbol: total.symbol,
            isTaker: item.is_taker,
            timeStamp: item.timestamp
        };

          allCanon.push(canon);
        }

        for (var i = 0; i < allTransactions.length; i++) {
            var item = allTransactions[i];
            var canon = {
                category: "transaction",
                id: item.id,
                transactionId: item.transaction_id,
                walletId: item.wallet_id,
                baseSymbol: item.currency_code,
                quantity: item.amount,
                status: item.status,
                fromAddress: item.information.fromAddress,
                toAddress: item.information.toAddress,
                type: item.type,
                timeStamp: parseInt(item.create_at)
            };

            if (item.type === "withdraw") {
                canon.feeQuantity = withdrawalFees[item.currency_code];
                canon.feeSymbol = item.currency_code;
            }

            allCanon.push(canon);
        }

        allCanon = _.orderBy(allCanon, function (item) { return item.timestamp; });

        var csvContents = allCanonToCsv(allCanon);
        console.log("CSV is ready and should have automatically downloaded. If it did not, check your that it wasn't blocked.");

        downloadCsv(csvContents, "coss-history.csv");
    };

    var getTradeHistory = function (fromDate, iteration) {        
        var effectiveIteration = iteration ? iteration : 0;
        console.log("Requesting Trade History - Iteartion " + effectiveIteration);

        var maxIterations = 100;
        var daysIncrement = 28;

        var fromDateNum = fromDate.getTime();
        var toDate = addDays(fromDate, daysIncrement);
        var toDateNum = toDate.getTime();
        var limit = 10000;

        var payload = {
            limit: limit,
            from_date: fromDateNum,
            to_date: toDateNum,
            sort_direction :"DESC",
            page: 0
        };

        var url = "https://coss.io/c/order/list/trade_history";

        var closure = { fromDate: fromDate, iteration: effectiveIteration };

        ajax(url, "POST", JSON.stringify(payload), function (response) {
            var data = JSON.parse(response);
            for (var i = 0; i < data.list.length; i++) {
                var order = data.list[i];
                allTrades.push(order);
            }

            var updatedFromDate = addDays(closure.fromDate, daysIncrement)
            if (updatedFromDate < new Date(2019, 0, 0) && closure.iteration + 1 < maxIterations) {
                setTimeout(function () { 
                    getTradeHistory(updatedFromDate, closure.iteration + 1);
                }, 500);
            } else {                
                onAllTradesReady();
            }
        });
    }

    var getTransactionHistory = function (callback) {
        console.log("Requesting transaction history.");

        var url = "https://coss.io/c/transactions/list";
        var payload = { limit:100000, sort_direction: "DESC"};
        ajax(url, "POST", JSON.stringify(payload), function (response) {
            console.log("Received transaction history");
            if (callback) { callback(response); }
        });
    };
    
    var allTransactions = [];
    var allTrades = [];
    getTransactionHistory(function (response) {
        allTransactions = JSON.parse(response).data;        
        getTradeHistory(new Date(2018, 0, 0));
    });
};


loadScript(momentUrl, loadAllHistory);