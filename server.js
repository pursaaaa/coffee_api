const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const PORT = process.env.PORT || 3001;

const userController = require('./controllers/UserController');
const productController = require('./controllers/ProductController');
const saleController = require('./controllers/SaleController');

const corsOptions = {
    origin: ['https://coffee-front.onrender.com', 'https://coffee-backoffice.onrender.com'], 
    credentials: true,
};
app.use(cors(corsOptions));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/uploads', express.static('uploads'));
app.use('/user', userController);
app.use('/product', productController);
app.use('/api/sale', saleController);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
