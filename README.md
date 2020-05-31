## Schedule bot
[Link](https://t.me/aefioiefjsrhfbsbjbot)

## Schedule bot
This bot is made for KPI students and teachers to get schedule

## Code style
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/9d9ff174b6cf44d3a577853bb9928d34)](https://www.codacy.com/manual/tedi4t/telegram_bot?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=tedi4t/telegram_bot&amp;utm_campaign=Badge_Grade)

## API/Frameworks
Built with
+ [Node.js](https://nodejs.org/uk/)
+ [Telegraf](https://telegraf.js.org/#/)
+ [Mongoose](https://github.com/Automattic/mongoose)
+ [Kpi rozklad](https://api.rozklad.org.ua/)

## How to use
[Tab here](https://t.me/aefioiefjsrhfbsbjbot) to work with bot. <br>
If you are student:
+ enter '/group' and name of your group in english or ukrainian e.g 
'/group ip93', '/group ip-93', '/group iп93' etc. If name of your group
 is too long(for example 'бм-91мп (бі)') you can enter only first 
 part - 'бм-91мп' in english or ukrainian. If bot can't find group name 
 write it in ukrainian.

If you are teacher:
+ enter '/teacher' and your name in ukrainian e.g. '/teacher Сергієко 
Анастасія Анатоліївна'. Your surname is obligatory, but name and paternal name 
aren't. Also you can write like this '/Сергієнко А А' and bot will find you.

If there are some result you will be able to choose one possible variant 
using a given list.

You can see all commands in telegram. 

## Some words about code
File getAllData.js is used to get data from API KPI rozklad to mongodb. I get
 schedule for every group and teacher and then I upload in one 
 collection('telegram_bot') but with different baseNames toMongoDB. Then in 
 file main.js I download this collection and work with that data. I suppose,
 that it's better because in this way response for command is much faster.

## Contact
If something went wrong, you can write [me in telegram](https://t.me/tedi4t)

## License
ISL © [Uryn Dmytro](https://github.com/tedi4t)

