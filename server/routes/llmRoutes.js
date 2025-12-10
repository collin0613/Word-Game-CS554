import {Router} from 'express'
import dotenv from 'dotenv'
import wordCorpus from '../words.json' with {type: 'json'}
import {GoogleGenAI} from '@google/genai'
import {z} from 'zod'
import {zodToJsonSchema} from 'zod-to-json-schema'
//GEMINI_API_KEY as environement variable. client automatically picks this up
//Initializing the Gemini API key and client
//
dotenv.config()
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
console.log(GEMINI_API_KEY)
const ai = new GoogleGenAI({})

//building the output schema from api call:
//
const hintSchema = z.object({
  hint: z.string().describe("Contents of the hint")
})


//helper function that allows gemini api to choose a random word from the corpus of word text. Takes in an object and returns the key value to be used
//for that object.
//
//Future implementation would be caching previously chosen words into redis and retrying another random key if word was already chosen.
//
const getRandomKey = (obj) => {
  if(!obj || typeof obj !== "object" || Array.isArray(obj)){
    console.error("Input must be an object")
    return null
  }

  const keys = Object.keys(obj)
  if(keys.length === 0){
    console.error("No keys found in object")
    return null
  }
  
  const randomIndex = Math.floor(Math.random() * keys.length)
  return keys[randomIndex]
}


const router = Router()

router.get('/', async (req, res) => {
  try{
    console.log("beginning of try")
    const currentWordKey = getRandomKey(wordCorpus)
    console.log("after random key: ", currentWordKey)
    
    const currentWord = wordCorpus[currentWordKey]
    console.log("after curr word")
    console.log(currentWord)
    
    //by nature, there will be 3 hints. hint 1 will be the most vague, hint 3 will be given after enough time has elapsed and will almost give away
    //the word
    //Prompt:
    const prompt = `
    Please create 3 hints for the word ${currentWord} that a group of people are trying to guess for a game. The first hint should be as vague as it can be, while the second hint is less vague, and the third hint is a dead giveaway. Under no circumstances should you include the word in any of the hints. 
    `
    const hints = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(hintSchema),
      },
    })
    console.log('hints:', hints)
    return res.status(200).json(hints)
  }catch (e){
    return res.status(500).json({error: "Failed to fetch hints"})
  }
})

export default router
