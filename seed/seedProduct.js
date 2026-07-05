const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    await Product.create({
      name: 'دهان بريميوم أبيض',
      description: 'دهان داخلي عالي الجودة، سهل التطبيق، يجف بسرعة ويعطي لمسة نهائية ناعمة. مثالي لجميع الغرف.',
      price: 1200,
      image: 'https://live.staticflickr.com/65535/55343397132_1ae9c890e0_b.jpg',
      category: 'paint',
      featured: true
    });
    console.log('✅ Product seeded');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
