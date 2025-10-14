const bcrypt = require('bcrypt');
const { db } = require('../utils/firebase');
const { collection, query, where, getDocs, setDoc, doc, getDoc } = require('firebase-admin/firestore');

const createUser = async (userData)=>{
    try{
        const { userId, ...data } = userData;
        await setDoc(doc(db, 'users', userId), data);

    }catch (error){
        throw new Error(`Erro ao criar usuário: ${error.message}`);
    }
};

const verifyUserCredentials = async (email, password) => {
    try{
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if(snapshot.empty){
            return null;
        }

        const user = snapshot.docs[0].data();

        const passwordHash = await bcrypt.compare(password, user.password);
        if(!passwordHash){
            return null;
        }
        return user;

    }catch (error){
        throw new Error(`Erro ao verificar credenciais: ${error.message}`);
    }
};

const verifyUserPasswordReset = async (email, dataNascimento) => {
    try{
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email), where('dataNascimento', '==', dataNascimento));
        const snapshot = await getDocs(q);

        if(snapshot.empty){
            return null;
        }

        const user = snapshot.docs[0].data();
        return user;

    }catch (error){
        throw new Error(`Erro ao verificar usuário para redefinição de senha: ${error.message}`);
    }
};

const resetUserPassword = async (userId, newPassword) => {
    try{
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await setDoc(doc(db, 'users', userId), { password: hashedPassword }, { merge: true});
    }catch (error){
        throw new Error(`Erro ao redefinir senha: ${error.message}`);
    }
};

const getUser = async (userId) => {
    try{
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if(!userDoc.exists()){
            return null;
        }
        return userDoc.data();

    }catch (error){
        throw new Error(`Erro ao obter usuário: ${error.message}`);
    }
};

module.exports = { getUser, createUser, verifyUserCredentials, resetUserPassword, verifyUserPasswordReset };
