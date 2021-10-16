// this is a const object that stores all options
// it is used to avoid having to write down every property for loading & saving
// by just iterating over its keys
// this is arguably only a minor boost to code-tidyness but it's here now
const $ = {
    outOfStock: document.getElementById("out-of-stock"),
    preorder: document.getElementById("preorder"),
    frontPage: document.getElementById("front-page"),
    enableSort: document.getElementById("enable-sort"),
    sortBy: document.getElementById("sort-by"),
    sortOrder: document.getElementById("sort-order"),
    darkMode: document.getElementById("dark-mode"),
    enableBorder: document.getElementById("enable-border"),
    borderStyle: document.getElementById("border-style"),
    borderWidth: document.getElementById("border-width"),
    borderColor: document.getElementById("border-color"),
    enableConversion: document.getElementById("enable-conversion"),
    currency: document.getElementById("currency"),
    exchangeRate: document.getElementById("exchange-rate")
};

// internal
const currencyTemplate = document.getElementById("currency-template");
var rates = undefined;

(async function initPopupWindow() {
    // this retrieves the current settings from the local storage
    // & applies them to the corresponding elements
    chrome.storage.local.get(Object.keys($), function (storage) {
        Object.keys($).forEach(element => {
            if ($[element].type == "checkbox") {
                $[element].checked = storage[element];
            } else {
                $[element].value = storage[element];
            }

            let fn = element == "enableConversion" ? conversionHandler : apply;
            $[element].addEventListener("change", fn);
        })

        if (storage.enableConversion) {
            getCurrencies();
            currency.disabled = false;
        } else {
            currency.disabled = true;
        }
    });
})();

// main function to apply changes by setting them in the local storage
// TODO: this could be done by listening to the event and only setting the
// necessary storage option rather than always setting every option
function apply() {
    let storage = {};
    Object.keys($).forEach(element => {
        let value = $[element].type == "checkbox" ? $[element].checked : $[element].value;
        storage[element] = value;
    });

    chrome.storage.local.set(storage);
    showExchangeRate();
}

function conversionHandler(event) {
    // ask for confirmation if the new state is checked
    // TODO: this probably should be done using the event rather than the global variable
    if ($.enableConversion.checked) {
        let result = confirm(`
        This feature will send requests to CoinBase (api.coinbase.com) in order to retrieve exchange rates.
        No personal data will be sent, but their privacy policy (https://coinbase.com/legal/privacy) applies.

        The prices displayed may not be what you will be charged.
        For instance, additional costs may be caused by your bank or the payment provider.

        Do you wish to proceed?`);

        // if the user clicked OK, enable the feature and let them interact with everything
        if (result) {
            currency.disabled = false;
            getCurrencies();
            apply();
        } else {
            // else be sure that everything remains disabled
            // since nothing was changed, there is no need to inform the content script
            $.enableConversion.checked = false;
            $.currency.disabled = true;
        }
    } else {
        // if enableConversion was deselected,
        // disable the currency selection and inform the content script
        $.currency.disabled = true;
        apply();
    }
}

function showExchangeRate() {
    // only show the exchange rate if we have rates available and if the selection isn't EUR
    // and if conversion is enabled to begin with
    // else empty the label so that nothing wrong is shown
    if (rates && $.currency.value != "EUR" && $.enableConversion.checked) {
        let rate = parseFloat(rates[$.currency.value]).toFixed(2).replace(".", ",");
        $.exchangeRate.innerText = `1,00 EUR ≈ ${rate} ${$.currency.value}`
        $.exchangeRate.appendChild(document.createElement("br"));
    } else {
        $.exchangeRate.innerText = "";
    }
}

function getCurrencies() {
    let xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function () {
        if (this.status != 200) {
            // create "fake" response data so that special handling is not required
            var data = {
                data: {
                    rates: [
                        {
                            "EUR": "1"
                        }
                    ]
                }
            };
        } else {
            var data = JSON.parse(this.responseText);
        }

        // create options for the select box using the template element
        for (const currencyName in data.data.rates) {
            let node = currencyTemplate.content.firstElementChild.cloneNode(true);
            node.setAttribute("value", currencyName);
            node.innerHTML = currencyName;
            $.currency.appendChild(node);
        }

        // save rates globally so they can be referenced in showExchangeRate() later
        // and don't need to be queried every time
        rates = data.data.rates;

        chrome.storage.local.get(["currency"], function (storage) {
            let currencyName = storage["currency"];

            // sanity check whether or not this option is actually set
            // TODO: this is probably unnecessary because defaults should be deployed
            // however, this should be tested first,
            // particularly because Firefox seemingly likes to fire some events early 
            if (currencyName) {
                if (data.data.rates[currencyName]) {
                    $.currency.value = currencyName;
                    showExchangeRate();
                    return;
                } else {
                    alert(`The currency you have selected ${currencyName} is no longer available.
                    Prices will be set to EUR again.`);
                }
            }

            // reset the currency option if no currency was set or
            // if it wasn't found within the coinbase data
            $.currency.value = "EUR";
            chrome.storage.local.set({ "currency": "EUR" });
            showExchangeRate();
        });
    });

    xhr.open("GET", "https://api.coinbase.com/v2/exchange-rates?currency=EUR");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send();
}