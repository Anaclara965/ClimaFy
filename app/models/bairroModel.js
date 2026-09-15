const bairros = [
    {id: 1, nome: 'Brás'},
    {id: 2, nome: 'Pinheiros'},
    {id: 3, nome: 'Vila Madalena'},

];

function normalizarTexto(texto) {
    return texto 
        .normalize("NFD") // Normaliza para decompor caracteres acentuados
        .replace(/[\u0300-\u036f]/g, "") // Remove os diacríticos
        .toLowerCase() // Converte para minúsculas
        .trim(); // Remove espaços em branco no início e no fim        
}

function buscarBairros(termo) {

    const termoNormalizado = normalizarTexto(termo);
    
    const encontrados = bairros.filter((bairro) => {
        return normalizarTexto(bairro.nome).includes(termoNormalizado);
    });
    return encontrados;
}

module.exports = { buscarBairros };