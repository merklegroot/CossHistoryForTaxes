var momentUrl = "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js";
var lodashUrl = "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js";
var downloadJsUrl = "https://cdnjs.cloudflare.com/ajax/libs/downloadjs/1.4.8/download.min.js";

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

var lastDownload = null;

var downloadCsv = function (flleName, contents) {
    download(contents, flleName, "text/csv");
    lastDownload = contents;
}

var getTransactionHistory = function (callback) {
    console.log("Requesting transaction history...");

    var url = "https://coss.io/c/transactions/list";
    var payload = { limit:100000, sort_direction: "DESC" };
    ajax(url, "POST", JSON.stringify(payload), function (response) {
        console.log("  Received transaction history.");
        if (callback) { callback(response); }
    });
};

var getTradeHistory = function (callback, closure) {
    var maxIterations = 10000;

    var effectiveClosure = closure || {
        fromDate: new Date(2000, 0, 0).valueOf(),
        toDate: new Date().valueOf(),
        iteration: 0,
        historyPages: []
    };

    var url = "https://coss.io/c/order/list/trade_history";

    var pageNumber = effectiveClosure.iteration;
    var payload = {"limit":50,"left":"","right":"","type":"","from_date":0,"to_date":1552193999999,"sort_direction":"DESC","page":pageNumber};

    console.log("Requesting trade history page " + (effectiveClosure.iteration + 1));
    ajax(url, "POST", JSON.stringify(payload), function (response) {
        var responseData = JSON.parse(response);
        effectiveClosure.historyPages.push({ 
            payload: payload,
            responseData: responseData
        });

        console.log("  Received trade history page " + (effectiveClosure.iteration + 1));

        if (effectiveClosure.iteration + 1 < maxIterations && responseData.list.length > 0) {
            effectiveClosure.iteration = effectiveClosure.iteration + 1;
            setTimeout(function () { getTradeHistory(callback, effectiveClosure); }, 1250);
            return;
        }

        console.log("All done retrieving trade history.");
        if (callback) {
            callback(effectiveClosure.historyPages);
        }
    });
};

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

var tradeToCanon = function (trade) {
    var tradingPair = parseTradingPair(trade.symbol);
    var fee = parseQuantityAndSymbol(trade.fee);
    var additionalFee = parseQuantityAndSymbol(trade.additional_fee);
    var total = parseQuantityAndSymbol(trade.total);

    var tradeMoment = moment(trade.timestamp);
    var timeStampText = tradeMoment.format("YYYY-MM-DD HH:mm:ss");    

    return {
        id: trade.hex_id,
        type: "TRADE",           
        orderId: trade.order_id,	  
        type: trade.order_side,
        baseSymbol: tradingPair.baseSymbol,
        quoteSymbol: tradingPair.quoteSymbol,
        price: trade.price,
        quantity: trade.quantity,
        feeQuantity: fee.quantity,
        feeSymbol: fee.symbol,
        additionalFee: additionalFee && additionalFee.quantity > 0 ? additionalFee.quantity : null,
        additionalFeeSymbol: additionalFee && additionalFee.quantity > 0 ? additionalFee.symbol : null,
        totalQuantity: total.quantity,
        totalSymbol: total.symbol,
        isTaker: trade.is_taker,
        timeStamp: trade.timestamp,
        timeStampText: timeStampText
    };
};

var transactionToCanon = function (item) {
    var timeStamp = parseInt(item.create_at);
    var transactionMoment = moment(timeStamp);
    var timeStampText = transactionMoment.format("YYYY-MM-DD HH:mm:ss");  

    var canon = {
        id: item.id,
        type: item.type ? item.type.toUpperCase() : null,        
        transactionId: item.transaction_id,
        walletId: item.wallet_id,
        baseSymbol: item.currency_code,
        quantity: item.amount,
        status: item.status,
        fromAddress: item.information.from_address,
        toAddress: item.information.to_address,
        timeStamp: timeStamp,
        timeStampText: timeStampText,
    };

    return canon;
};

var allCanonToCsv = function (allCanon) {
    var disclaimer = "Withdrawal fees aren't included.";
    var columns = "Id, Time Stamp, Type, Base Symbol, Quote Symbol, Price, Quantity, Total, , Fee, , Additional Fee, , Order Id, Transaction Id, From Address, ToAddress";
    var resultText = "";

    resultText += disclaimer + "\r\n" + columns + "\r\n";
    for (var i = 0; i < allCanon.length; i++) {
        var item = allCanon[i];
        
        rowText = item.id + ", "
            + item.timeStampText + ", " 
            + item.type + ", "
            + (item.baseSymbol || "") + ", " 
            + (item.quoteSymbol || "") + ", "                
            + (item.price || "") + ", "
            + (item.quantity || "") + ", "
            + (item.totalQuantity || "") + ", "
            + (item.totalSymbol || "") + ", "
            + (item.feeQuantity || "") + ", "
            + (item.feeSymbol || "") + ", "
            + (item.additionalFeeQuantity || "") + ", "
            + (item.additionalFeeSymbol || "") + ", "
            + (item.orderId || "") + ", "
            + (item.transactionId || "") + ", "
            + (item.fromAddress || "") + ", "
            + (item.toAddress || "") + ", ";

        resultText += rowText + "\r\n";
    }

    return resultText;
};

var run = function () {

    var closure = {
        allTransactions: [],
        historyPages: []
    };

    var onTradeHistoryReady = function (historyPages) {
        closure.historyPages = historyPages;

        var transactionCanon = _.map(closure.allTransactions, function (item) { return transactionToCanon(item); });

        var historyCanon = [];
        for (var i = 0; i < closure.historyPages.length; i++) {
            var historyCanonGroup = _.map(closure.historyPages[i].responseData.list, function (item) { return tradeToCanon(item) });
            historyCanon = historyCanon.concat(historyCanonGroup);
        }

        var allCanon = transactionCanon.concat(historyCanon);
        var filteredCanon = _.filter(allCanon, function (item) {
            return item.timeStamp >= new Date(2018, 0, 0) && item.timeStamp < new Date(2019, 0, 0);
        });

        var sortedFilteredCanon = _.sortBy(filteredCanon, function (item) { return item.timeStamp; });

        var csv = allCanonToCsv(sortedFilteredCanon);

        var fileName = "coss-2018-history.csv";
        console.log("All done! File " + fileName + " should have downloaded." + "\r\n" + 
            "If it did not, please check your pop-up blocker." + "\r\n");

        downloadCsv("coss-2018-history.csv", csv);
    }

    var onTransactionHistoryReady = function (response) {
        closure.allTransactions = JSON.parse(response).data;
        getTradeHistory(onTradeHistoryReady);
    };

    loadScript(momentUrl, function () {
        loadScript(lodashUrl, function () {
            loadScript(downloadJsUrl, function () {
                getTransactionHistory(onTransactionHistoryReady);
            });
        });
    });
};

run();

