# PowerKeys
Advanced tools for [candykeys.com](https://candykeys.com)!

## Features
- Hide items that are out of stock or only for preorder
- Sort items based on their price, name or rating
- Dark mode
- Draw borders around images for better accessibility
- Convert EUR-prices to other currencies

## Installation
This extension uses ManifestV2 and is cross-platform with Firefox and Chromium-based browsers. Simply load it as unpacked from `about:debugging` (Firefox) or `chrome://extensions` (Chrome) or get it from the extension store once available.

## Structure
[install.js](install.js) is a simple script that defines an event for when the extension is first installed. It sets default values to the user choices & may be used for updating preferences with later revisions.

[powerkeys.js](powerkeys.js) is the primary source and loaded as a content-script on candykeys's website. This loads & applies all selected options which are stored in the extension's local storage. In addition, it listens to updates to the local storage to apply options accordingly.

[dark.css](dark.css) is the CSS that is injected into the [candykeys.com](candykeys.com) website if the user selects the "Dark mode" option.

Files in [popup/](popup/) are used to create the extension window with which the user can interact. It is seperated into [HTML](popup/popup.html), [JavaScript](popup/popup.js) and [CSS](popup/popup.css). The JS updates the local storage of the extension based on the user's interaction.

[manifest.json](manifest.json) defines the extension's properties according to the ManifestV2 spec. This is planned to be updated to ManifestV3 once Firefox has fully adopted it.

## Inclusion of Coinbase API
In order to convert currencies, this extension may get info from [api.coinbase.com](api.coinbase.com). This is done because unlike many other APIs, Coinbase's does not require any form of authentication in order to get exchange rates. This causes the extension to also display crypto-currencies - but this still may be useful for some :)
However, it is important to note that [their privacy policy](https://coinbase.com/legal/privacy) does apply if you choose to use this feature.

## Feedback
If you don't have a GitHub account, feel free to provide feedback through [this Google Form](https://forms.gle/fzissAsEWoGiZ57F8).

## Acknowledgements
Thanks to everybody who was bearing with me with continous testing and for providing feedback. Also thanks to Rucola from the [CandyKeys Discord](https://discord.gg/8DUgfzyxe4) who inspired me to make this, by posting JavaScript snippets to accomplish some of the features this extension includes.