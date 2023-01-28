import { Schema, model, mongoose, Types } from 'mongoose';
mongoose.set('strictQuery', false);
import autopopulate from 'mongoose-autopopulate';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URL);
mongoose.Promise = global.Promise;

mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Схема
let Orders_schema = new Schema({
    orderDate: Date,
    client: {
        type: Schema.Types.ObjectId,
        ref: 'Clients',
        autopopulate: true
    },
    item: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Prices',
            autopopulate: true
        },
        volume: Number,                 // Литры
    }],
    // pail: {                         // ведро
    //     type: String,
    //     enum: ['None', '10 л', '5 л'],
    //     trim: true,
    //     default: 'None'
    // },
    appendix: String
});
Orders_schema.plugin(autopopulate);

Orders_schema.statics.findByClientAndDate = async function (id, date) {
    return this.find({ client: Types.ObjectId(id), orderDate: date });
}
Orders_schema.statics.findOneByClientAndDate = async function (id, date) {
    return await this.findOne({ 'client': id, 'orderDate': date });
}
Orders_schema.statics.findBySalerAndDate = async function (id, date) {
    let goods = model('Prices').find({ 'saler': id, 'active': true });
    return await this.find({ 'item': { $in: goods }, 'orderDate': date });
}

let client_schema = new Schema({
    login: {
        type: String,
        unique: true,
        required: true
    },
    password: String,
    fullName: {
        type: String,
        unique: true,
        required: true
    },
    phone: String,
    town: String,
    street: String,
    house: String,
    entrance: String,
    appartment: String,
    addition: String,                // код домофона 
    role: {
        type: String,
        enum: ['buyer', 'saler'],
        default: 'buyer',
        requred: true
    }
});

client_schema.virtual('fullAddress')
    .get(function () {
        return `${this.town}, ${this.street}, д. ${this.house}`
            + (!this.entrance ? "" : `, подъезд ${this.entrance} `)
            + (!this.appartment ? "" : `, кв. ${this.appartment}`)
            + (!this.addition ? "" : `, ${this.addition}`).trim();
    });

let price_schema = new Schema({
    product: {
        type: String,
        trim: true
    },
    price: Number,
    active: {
        type: Boolean,
        default: true
    },
    client: { // продавец
        type: Schema.Types.ObjectId,
        ref: 'Clients',
        autopopulate: true
    }
});

price_schema.statics.pricesBySaler = async function (saler) {
    return this.find({ client: Types.ObjectId(saler) });
}

price_schema.statics.toAssociativeArray = async function () {
    let ret = {};
    let p = await this.find({ active: true });
    p.forEach(item => {
        ret[item._id] = item;
        // ret[item.product] = item;
    });
    return ret;
};

export const Prices = model('Prices', price_schema);
export const Clients = model('Clients', client_schema);
export const MilkOrders = model('MilkOrders', Orders_schema);
