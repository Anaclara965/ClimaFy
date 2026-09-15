const { buscarBairros } = require("../models/bairroModel");

function listarBairros(req, res) {
    const busca = req.query.busca ?? "";

    if(typeof busca !== 'string' || busca.length > 100) {
        return res.status(400).json({ 
            error: 'A busca deve ser um texto de até 100 caracteres.' 
        });

    }

    const termo = busca.trim().toLowerCase();
    const encontrados = buscarBairros(termo)

    return res.status(200).json(encontrados);
}

module.exports = { listarBairros };
