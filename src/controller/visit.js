const catchAsync = require('../util/catchAsync');
const db = require('../models')
const axios = require('axios');
db.category.hasMany(db.report_display, { as: "json_paths", foreignKey: 'category_id' });

const getVisit = catchAsync(async (req, res) => {
    const {visit_id: visitId} = req.params
    const v = await db.report_display.findAll({
        where: {
            visit_id: visitId
        }
    })
    if(v.length > 0){
        res.status(200).json(v)
    }
    else{
        res.status(400).json({
            message: "visit not found"
        })
    }
})

const getReportDisplay = catchAsync(async (req, res) => {
    /** logic here */
    const visit_id = req.body.visit_id

    //Query report
    const getReport = await db.sequelize.query(
        `SELECT 
        rd.visit_id, s.id as store_id, s.name as store_name, 
        sr.id as surveyor_id, sr.username as surveyor_name  
        FROM report_display as rd 
        LEFT JOIN store as s on rd.store_id = s.id
        LEFT JOIN surveyor as sr on rd.surveyor_id = sr.id 
        WHERE rd.visit_id = :visit_id
        GROUP BY visit_id`, {
            replacements : {
                visit_id: visit_id
            },
            type: db.sequelize.QueryTypes.SELECT
        }
    );

    //Query Display
    const getDisplay = await db.category.findAll({
        attributes: [['id','category_id'], ['name', 'category_name']],
        include: [{
            where: {
                visit_id: visit_id
            },
            model: db.report_display,
            as: "json_paths",
            attributes: [
                ['json_path', 'path'],
            ],
        }],
    })
    getReport[0].displays=getDisplay
    /* contoh output */
    const expectedOutput = {
        visit_id: "V.26.865.22081208343138",
        store_id: 865,
        store_name: "Toko A",
        surveyor_id: 1,
        surveyor_name: "Surveyor 1",
        displays: [
            {
                category_id: 1,
                category_name: "SKin Care",
                json_paths : [
                    {path: "https://storage2.pitjarus.co/galderma/jsons/20220812/V.26.865.22081208343138_1_1_display1_1.json"},
                    {path: "https://storage2.pitjarus.co/galderma/jsons/20220812/V.26.865.22081208343138_1_1_display1_2.json"}
                ]
            },
            {
                category_id: 2,
                category_name: "SKin Cleansing",
                json_paths : [
                    {path: "https://storage2.pitjarus.co/galderma/jsons/20220812/V.26.865.22081208343138_2_2_display2_1.json"},
                    {path: "https://storage2.pitjarus.co/galderma/jsons/20220812/V.26.865.22081208343138_2_2_display1_1.json"}
                ]
            }
        ]
    }
    res.status(200).json(getReport)
})

const getReportProduct = catchAsync(async (req, res) => {
    /** logic here */
    let products = []
    let product = []
    const count = {};
    const visit_id = req.body.visit_id
    //Query JSON Path
    const getJsonPath = await db.report_display.findAll({
        where: {
            visit_id: visit_id
        },
        attributes: [
            'json_path',
        ],
    })

    // Get label product
    for (let index = 0; index < getJsonPath.length; index++) {
        const element = getJsonPath[index].json_path;
        const getData = await axios.get(element)
        for (let index = 0; index < getData.data.length; index++) {
            const element = getData.data[index].object_name;
            product.push(element);
        }
    }
    //Count product
    product.forEach(element => {
        count[element] = (count[element] || 0) + 1;
    });

    // Query product id
    let productName = Object.keys(count)
    for (let index = 0; index < productName.length; index++) {
        const element = productName[index];
        const value = Object.values(count)[index];
        const getProductID = await db.product.findOne({
            where: {
                label: element
            },
            attributes: [
                'id',
            ],
        })
        let data = {
            product_id: getProductID.id,
            jumlah: value,
        }
        products.push(data);
    }
    let response = {
        visit_id: visit_id,
        products: products
    }
    /* contoh output */
    const expectedOutput = {
        visit_id: "V.26.865.22081208343138",
        products: [
            {product_id: 1, jumlah: 1},
            {product_id: 2, jumlah: 2},
            {product_id: 3, jumlah: 1},
            {product_id: 5, jumlah: 6},
        ]
    }
    res.status(200).json(response)
})

const batchReportProduct = catchAsync(async (req, res) => {
    /** logic here */
    const visit_id = req.body.visit_id
    let { PORT } = process.env
    let getReportProduct = await axios.post(`http://localhost:${ PORT }/product-visit`,{visit_id: visit_id})
    
    const reportProducts = getReportProduct.data.products.map(product => {
        return {
            visit_id: visit_id,
            product_id: product.product_id,
            jumlah_product: product.jumlah
        }
    })
    db.report_product.bulkCreate(reportProducts);

    res.status(200).json({
        status: "OK",
        message: "batch success"
    })
})



module.exports = {
    getVisit,
    getReportDisplay,
    getReportProduct,
    batchReportProduct
}