import express from 'express';
import cors from 'cors';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import PaymentCode from '@kiraind/gost-r-56042-2014';


// import cors from 'cors';

import dotenv from 'dotenv';
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
console.log(__dirname);

const server = new express();
server.use(cors());
server.use('/', express.static(__dirname + '/public'));
server.set('view engine', 'ejs');

const server_back = new express();
server_back.use(cors());
server_back.use(express.static(__dirname + '/public'));
server_back.set('view engine', 'ejs');

// бинесс-логика
import { Clients, MilkOrders, Prices } from './mongo.js';

server.listen(process.env.PORT, err => {
    if (err)
        throw err;
    console.log(`Server listening on ${process.env.PORT}`);
});

server_back.listen(process.env.PORT_BACK, err => {
    if (err)
        throw err;
    console.log(`ServerBak listening on ${process.env.PORT_BACK}`);
});

server.get('/', async (q, r) => {
    r.sendFile(__dirname + '/public/registry.html');
});

server.get('/dispOrders', async (q, r) => {
    let dat = q.query?.Date;
    let saler = q.query.saler;

    if (!dat)
        dat = getSatuгDay(new Date());
    else
        dat = new Date(dat);
    let o = await MilkOrders.find({ orderDate: dat }).sort('-volume');
    r.render('DispNextOrders', { saler: saler, date: getSatuгDay(new Date()).toLocaleDateString(), orders: o });
});

server.post('/saveOrder', express.urlencoded({ extended: false }), async (q, r) => {
    let { clientId, orderId, volume, product, appendix } = q.body;
    let O = (orderId !== '') ? await MilkOrders.findById(orderId) : null;
    if (!O) {
        O = new MilkOrders();
    }
    O.client = clientId;
    for (let i = 0; i < product.length; i++) {
        if (volume[i])
            O.item.push({ product: product[i], volume: volume[i] });
    }
    O.orderDate = getSatuгDay(new Date());
    O.appendix = appendix;
    await O.save();

    //QR
    let P = await Prices.toAssociativeArray();
    let x = 0;
    let orderSumm = O.item.map(i => x += i.volume * P[i.product._id].price).reverse()[0];
    const pngBuffer = await PaymentCode.toDataURL({
        Name: process.env.Firm,
        PersonalAcc: process.env.PersonalAcc,
        CorrespAcc: process.env.CorrespAcc,
        PayeeINN: process.env.PayeeINN,

        BankName: process.env.BankName,
        BIC: process.env.BIC,
        // Name: 'ООО "Три кита"',
        // PersonalAcc: '40702810138250123017',
        // CorrespAcc: '30101810400000000225',
        // PayeeINN: '6200098765',

        // BankName: 'ОАО "БАНК"',
        // BIC: '044525225',

        // LastName: 'Иванов',
        // FirstName: 'Иван',
        // MiddleName: 'Иванович',
        Purpose: `Оплата по счету ${O?._id}`,
        // Purpose: 'Оплата членского взноса',
        // PayerAddress: 'г.Рязань, ул.Ленина, д.10, кв.15',

        Sum: orderSumm
    }, {
        scale: 5,
        errorCorrectionLevel: 'L'
    })
        .then(url => r.render('confirmation', {
            order: O, date: getSatuгDay(new Date()).toLocaleDateString(), URL: url, orderSumm: orderSumm
        }))
        .catch(err => {
            r.status(500).send(err);
            console.debug(err)
        })
    //QR
    // r.render('confirmation', { id: O?._id, date: getSatuгDay(new Date()).toLocaleDateString(), URL: url });
});

server.post('/userprofile', express.urlencoded({ extended: false }), async (q, r) => {
    let { salerId, role, login, password, FullName, phone, town, street, house, entrance, appartment, addition, volume, pail, appendix } = q.body;
    let client = salerId ? await Clients.findById(salerId) : null;
    if (!client) { // клиент не существует создаем его
        client = new Clients();
        client.login = login;
        client.password = password;
        client.fullName = FullName;
        client.phone = phone;
        client.town = town;
        client.street = street;
        client.house = house;
        client.entrance = entrance;
        client.appartment = appartment;
        client.addition = addition;
        client.role = role == 'on' ? 'saler' : 'buyer';
        await client.save();
    }

    // выбор действий в зависимости от роли пользователя
    if (client.role === 'buyer') {
        let order = await MilkOrders.findOne({ 'orderDate': getSatuгDay(new Date()), 'client': client._id });
        let P = await Prices.toAssociativeArray();
        r.render('orderM', { saler: client?._id, order: order, prices: P });
        // r.render('order', { saler: client._id, order: order, prices: P });
    } else {
        let orders = await MilkOrders.find({ orderDate: getSatuгDay(new Date()) }).sort('-volume');
        r.render('DispNextOrders', { 'saler': client._id, 'date': getSatuгDay(new Date()).toLocaleDateString(), 'orders': orders });
    }
});

server.get('/editUserCard', async (q, r) => {
    let client = await Clients.findOne({ 'client': q.query.saler });
    // if (!client) { // новый клиет
    r.render('edituser', { 'saler': client });
    // }
});

server.post('/editUserCard', express.urlencoded({ extended: false }), async (q, r) => {
    let client = await Clients.findOne({ 'client': q.body.saler });
    r.render('edituser', { 'saler': client });
});

server.post('/login', express.json(), async (q, r) => {
    let client = await Clients.findOne({ 'login': q.body.login, 'password': q.body.password });
    if (!client) { // новый клиет
        r.render('edituser', { 'login': q.body.login, 'password': q.body.password, 'saler': client });
    } else { // старый клиент
        // if (client?.role === 'buyer') {
        r.render('edituser', { 'saler': client });

    }
});

function getSatuгDay(date) {
    let d = new Date(date);
    let dayNumber = d.getDay();
    let r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayNumber + 6);
    return r;
}

server.get('/price', async (q, r) => {
    let saler = q.query.saler;
    let P = await Prices.pricesBySaler(saler);
    r.render('editprice', { saler: saler, price: P })
});

server.post('/saveprice', express.urlencoded({ extended: false }), async (q, r) => {
    let { id, active, price, product, saler } = q.body;
    for (let i = 0; i < id.length; i++) {
        if (!id[i]) {
            let Np = new Prices();
            Np.product = product[i];
            Np.price = price[i];
            Np.active = active[i] === true;
            Np.client = saler;
            await Np.save();
        } else {
            if (active.includes(id[i]))
                await Prices.findByIdAndUpdate(id[i], { $set: { product: product[i], price: price[i], active: true } });
            else
                await Prices.findByIdAndUpdate(id[i], { $set: { product: product[i], price: price[i], active: false } });
        }
    }
    let P = await Prices.pricesBySaler(saler);
    r.render('editprice', { saler: saler, price: P });
});

server.get('/map', async (q, r) => {
    var url = "https://cleaner.dadata.ru/api/v1/clean/address";
    var token = "05406ceffd3eefe288b50ae4061a40c10dc792db";
    var secret = "61190505096834b967219201c9513af95c75ef94";
    var query = "симферопольл дзюбанова 1";

    var options = {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Token " + token,
            "X-Secret": secret
        },
        body: JSON.stringify([query])
    }
    let R;
    await fetch(url, options)
        .then(response => response.json())
        .then(result => R = result)
        .catch(error => console.log("error", error));
    // let B=R.split(',');

    r.send(`${R}`);//<br>${R.geo_lat}, ${R.geo_lon}`)
});