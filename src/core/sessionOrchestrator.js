/**
 * Session Orchestrator
 * Composes daily sessions by selecting appropriate units
 */

import { classifyDomain, DOMAIN_TYPES } from './domains.js';
import { calculateCoverageDebt, getDefaultWeeklyFloor } from './coverage.js';
import { prioritizeByDifficulty } from './difficulty.js';
import { getUnitTypesForDomain, UNIT_TYPES } from './units.js';
import { getDefaultDomainMode } from './domainMode.js';

/**
 * Orchestrates a mood mode session (untimed, N questions based on custom prompt)
 * @param {Object} params
 * @param {Object} params.databases - Map of domain name to database ID(s)
 * @param {number} params.questionCount - Number of questions (5 or 10)
 * @param {string} params.customPrompt - User's custom intent/prompt
 * @param {Object} params.attemptsData - Recent attempts for readiness calculation
 * @param {Function} params.getAttemptsData - Get attempts data function
 * @param {Function} params.fetchItems - Fetch items by source database ID
 * @param {Object} params.aiService - AI service for question selection
 * @returns {Promise<Array>} Array of unit objects
 */
export const orchestrateMoodSession = async ({
  databases,
  questionCount = 5,
  customPrompt,
  attemptsData = {},
  getAttemptsData,
  fetchItems,
  aiService
}) => {
  // Fetch all items
  const domainEntries = Object.entries(databases).sort(([a], [b]) => a.localeCompare(b));
  const allItems = await Promise.all(
    domainEntries.flatMap(([domain, dbIds]) => {
      const ids = Array.isArray(dbIds) ? dbIds : [dbIds];
      return Promise.all(ids.map(async (dbId) => {
        const items = await fetchItems(dbId);
        // #region agent log
        if (dbId === ids[0] && domainEntries[0]?.[0] === domain) {
          fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:38',message:'Raw items from fetchItems',data:{isArray:Array.isArray(items),type:typeof items,keys:items?Object.keys(items).slice(0,10):[],firstItem:items?.[0],firstItemKeys:items?.[0]?Object.keys(items[0]).slice(0,10):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion
        // Ensure items is an array (not array-like object)
        let itemsArray;
        if (Array.isArray(items)) {
          itemsArray = items;
        } else if (items && typeof items === 'object') {
          // Check if items itself is an array-like object (has numeric string keys)
          const itemKeys = Object.keys(items);
          const hasNumericKeys = itemKeys.length > 0 && itemKeys.every(k => /^\d+$/.test(k));
          if (hasNumericKeys) {
            // Extract all items from the array-like structure
            itemsArray = Object.values(items);
          } else {
            // Regular object, convert to array
            itemsArray = Object.values(items);
          }
        } else {
          itemsArray = [];
        }
        
        // #region agent log
        if (dbId === ids[0] && domainEntries[0]?.[0] === domain) {
          fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:42',message:'After array conversion',data:{itemsArrayLength:itemsArray.length,firstItem:itemsArray[0],firstItemKeys:itemsArray[0]?Object.keys(itemsArray[0]).slice(0,10):[],firstItemIsArray:Array.isArray(itemsArray[0])},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion
        
        // Ensure each item is a plain object, not nested
        return itemsArray.flatMap((item) => {
          // If item has numeric keys, it's an array-like object - extract all values
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            const keys = Object.keys(item);
            // Check if this looks like an array-like object (has numeric string keys)
            const hasNumericKeys = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
            // #region agent log
            if (dbId === ids[0] && domainEntries[0]?.[0] === domain && keys.length > 0) {
              fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:58',message:'Checking item structure',data:{hasNumericKeys,keys:keys.slice(0,10),itemType:typeof item,itemIsArray:Array.isArray(item)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            }
            // #endregion
            if (hasNumericKeys && keys.length > 0) {
              // Extract ALL items from the array-like structure
              const extractedItems = Object.values(item);
              // #region agent log
              if (dbId === ids[0] && domainEntries[0]?.[0] === domain && extractedItems.length > 0) {
                fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:66',message:'After extracting from numeric keys',data:{extractedCount:extractedItems.length,firstExtracted:extractedItems[0],firstExtractedKeys:extractedItems[0]?Object.keys(extractedItems[0]).slice(0,10):[],hasId:'id' in (extractedItems[0]||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
              }
              // #endregion
              // Return all extracted items with domain
              return extractedItems.map(extractedItem => ({ ...extractedItem, domain }));
            }
          }
          // Regular item, just add domain
          return [{ ...item, domain }];
        });
      }));
    })
  ).then(results => {
    // Flatten deeply - results might be nested arrays from flatMap
    const flattened = results.flat(Infinity);
    // Ensure all items are plain objects, not arrays
    const finalItems = flattened.filter(item => 
      item && typeof item === 'object' && !Array.isArray(item)
    );
    return finalItems;
  });

  // Filter uncompleted items
  const attemptsContext = getAttemptsData ? getAttemptsData([], {}) : attemptsData;
  const completedItemIds = new Set(
    Object.values(attemptsContext.itemData || {})
      .filter(meta => meta.lastResult === 'Solved')
      .map(meta => meta.itemId)
  );

  // Log sample item structure to understand what fields are available
  if (allItems.length > 0) {
    const sampleItem = allItems[0];
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:54',message:'Sample item before normalization',data:{keys:Object.keys(sampleItem),first10Keys:Object.keys(sampleItem).slice(0,10),hasId:'id' in sampleItem,has_id:'_id' in sampleItem,id:sampleItem.id,_id:sampleItem._id,itemId:sampleItem.itemId,item_id:sampleItem.item_id,allKeys:Object.keys(sampleItem)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }

  const uncompletedItems = allItems.filter(item => {
    // Use flexible ID checking
    const itemId = item.id || item._id || item.itemId || item.item_id;
    return !item.completed && !completedItemIds.has(itemId);
  });
  
  // Normalize items to have consistent 'id' field
  const normalizedUncompletedItems = uncompletedItems.map((item, idx) => {
    const itemId = item.id || item._id || item.itemId || item.item_id;
    // #region agent log
    if (idx === 0) {
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:74',message:'Normalizing first item',data:{beforeKeys:Object.keys(item),itemId,foundId:!!itemId,id:item.id,_id:item._id,itemId_field:item.itemId,item_id:item.item_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    const normalized = {
      ...item,
      id: itemId
    };
    // #region agent log
    if (idx === 0) {
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:82',message:'After normalization',data:{hasId:'id' in normalized,id:normalized.id,keys:Object.keys(normalized)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    return normalized;
  });

  if (normalizedUncompletedItems.length < questionCount) {
    throw new Error(`Not enough uncompleted items. Need ${questionCount}, have ${normalizedUncompletedItems.length}`);
  }

  console.log('[orchestrateMoodSession] Items fetched', {
    totalItems: allItems.length,
    uncompletedItems: normalizedUncompletedItems.length,
    questionCount,
    customPrompt
  });

  // Use AI to select questions based on custom prompt
  let selectedItems = [];
  
  // Extract keywords from user prompt for better matching
  const promptLower = (customPrompt || '').toLowerCase();
  const keywords = {
    array: promptLower.includes('array') || promptLower.includes('arrays'),
    dp: promptLower.includes('dp') || promptLower.includes('dynamic programming'),
    graph: promptLower.includes('graph') || promptLower.includes('graphs'),
    tree: promptLower.includes('tree') || promptLower.includes('trees'),
    string: promptLower.includes('string') || promptLower.includes('strings'),
    quality: promptLower.includes('quality') || promptLower.includes('good') || promptLower.includes('best'),
    dsa: promptLower.includes('dsa') || promptLower.includes('data structure') || promptLower.includes('algorithm'),
    pattern: promptLower.match(/\b(pattern|patterns)\b/),
    topic: promptLower.match(/\b(topic|topics|concept|concepts)\b/)
  };

  if (aiService && customPrompt?.trim()) {
    try {
      // Extract intent keywords for filtering
      const promptLower = (customPrompt || '').toLowerCase();
      const wantsGraph = promptLower.includes('graph') || promptLower.includes('graphs');
      const wantsTree = promptLower.includes('tree') || promptLower.includes('trees');
      const wantsArray = promptLower.includes('array') || promptLower.includes('arrays');
      const wantsDP = promptLower.includes('dp') || promptLower.includes('dynamic programming');
      const wantsString = promptLower.includes('string') || promptLower.includes('strings');
      const wantsHard = promptLower.includes('hard') || promptLower.includes('difficult') || promptLower.includes('challenging');
      const wantsEasy = promptLower.includes('easy');
      const wantsMedium = promptLower.includes('medium');
      
      // Prioritize items that match the intent
      const prioritizedItems = [...normalizedUncompletedItems].sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        
        const patternA = (a.pattern || '').toLowerCase();
        const patternB = (b.pattern || '').toLowerCase();
        const nameA = (a.name || a.title || '').toLowerCase();
        const nameB = (b.name || b.title || '').toLowerCase();
        const domainA = (a.domain || '').toLowerCase();
        const domainB = (b.domain || '').toLowerCase();
        
        // Pattern matching (highest priority)
        if (wantsGraph && (patternA.includes('graph') || nameA.includes('graph'))) scoreA += 100;
        if (wantsGraph && (patternB.includes('graph') || nameB.includes('graph'))) scoreB += 100;
        if (wantsTree && (patternA.includes('tree') || nameA.includes('tree'))) scoreA += 100;
        if (wantsTree && (patternB.includes('tree') || nameB.includes('tree'))) scoreB += 100;
        if (wantsArray && (patternA.includes('array') || nameA.includes('array'))) scoreA += 100;
        if (wantsArray && (patternB.includes('array') || nameB.includes('array'))) scoreB += 100;
        if (wantsDP && (patternA.includes('dynamic programming') || patternA.includes('dp') || nameA.includes('dp'))) scoreA += 100;
        if (wantsDP && (patternB.includes('dynamic programming') || patternB.includes('dp') || nameB.includes('dp'))) scoreB += 100;
        if (wantsString && (patternA.includes('string') || nameA.includes('string'))) scoreA += 100;
        if (wantsString && (patternB.includes('string') || nameB.includes('string'))) scoreB += 100;
        
        // Domain matching (DSA for coding problems)
        if ((wantsGraph || wantsTree || wantsArray || wantsDP || wantsString) && domainA === 'dsa') scoreA += 50;
        if ((wantsGraph || wantsTree || wantsArray || wantsDP || wantsString) && domainB === 'dsa') scoreB += 50;
        
        // Difficulty matching
        const diffA = a.difficulty || 3;
        const diffB = b.difficulty || 3;
        if (wantsHard && diffA >= 4) scoreA += 30;
        if (wantsHard && diffB >= 4) scoreB += 30;
        if (wantsEasy && diffA <= 2) scoreA += 30;
        if (wantsEasy && diffB <= 2) scoreB += 30;
        if (wantsMedium && diffA === 3) scoreA += 30;
        if (wantsMedium && diffB === 3) scoreB += 30;
        
        return scoreB - scoreA; // Higher score first
      });
      
      // Take top 100 prioritized items for the prompt
      const itemsForPrompt = prioritizedItems.slice(0, 100);
      
      // Build rich context about available items
      const domainStats = {};
      const patternStats = {};
      const difficultyStats = { easy: 0, medium: 0, hard: 0 };
      
      itemsForPrompt.forEach(item => {
        const domain = item.domain || 'Unknown';
        domainStats[domain] = (domainStats[domain] || 0) + 1;
        
        if (item.pattern) {
          patternStats[item.pattern] = (patternStats[item.pattern] || 0) + 1;
        }
        
        const diff = item.difficulty || 3;
        if (diff <= 2) difficultyStats.easy++;
        else if (diff === 3) difficultyStats.medium++;
        else if (diff >= 4) difficultyStats.hard++;
      });
      
      const promptItems = itemsForPrompt.map((item, idx) => {
        const name = item.name || item.title || 'Untitled';
        const domain = item.domain || 'Unknown';
        const pattern = item.pattern || '';
        const difficulty = item.difficulty || '';
        const diffLabel = difficulty >= 4 ? 'Hard' : difficulty <= 2 ? 'Easy' : difficulty === 3 ? 'Medium' : '';
        return `${idx + 1}. "${name}" [${domain}]${pattern ? ` (Pattern: ${pattern})` : ''}${diffLabel ? ` [${diffLabel}]` : ''}`;
      }).join('\n');

      const selectionPrompt = `You are an intelligent learning assistant for an interview preparation platform. Your role is to curate personalized learning sessions that match the user's specific learning goals.

## Your Context

**System Purpose**: This is an autopilot interview preparation system that helps users efficiently cover all relevant interview domains. The system supports multiple learning domains:
- **Coding domains** (DSA, OA): Algorithm and data structure problems with patterns like Graph, Tree, Array, Dynamic Programming, String, etc.
- **Fundamentals domains** (OS, DBMS, CN, OOP): Conceptual knowledge about systems, databases, networking, and object-oriented design
- **Interview domains** (Behavioral, HR, Phone Screen): Soft skills and interview scenarios
- **Spice domains** (Aptitude, Puzzles): Optional enrichment content

**Item Structure**: Each question/item has:
- **Domain**: The learning category (DSA, OS, DBMS, etc.)
- **Pattern**: For coding problems, the algorithmic pattern (Graph, Tree, Array, DP, etc.)
- **Difficulty**: 1-2 (Easy), 3 (Medium), 4-5 (Hard)
- **Name/Title**: The question or topic name

**Your Task**: Select exactly ${questionCount} questions from the available pool that best match the user's learning intent.

## User Intent

"${customPrompt}"

## Available Questions

Total available: ${normalizedUncompletedItems.length} uncompleted items
Showing top 100 most relevant items (sorted by relevance to your intent):

${promptItems}

## Available Context

**Domains in this selection**: ${Object.keys(domainStats).join(', ')}
**Patterns available**: ${Object.keys(patternStats).slice(0, 10).join(', ')}${Object.keys(patternStats).length > 10 ? ' and more' : ''}
**Difficulty distribution**: ${difficultyStats.easy} Easy, ${difficultyStats.medium} Medium, ${difficultyStats.hard} Hard

## Selection Guidelines

1. **Understand the user's intent deeply**: What domain do they want? What patterns? What difficulty level?
2. **Match patterns precisely**: If they mention "graph problems", select items with "Graph" pattern from DSA domain
3. **Respect domain boundaries**: Don't select Aptitude items if they want coding problems (DSA)
4. **Consider difficulty**: If they mention "hard", prioritize items with difficulty 4-5
5. **Be contextually aware**: Understand that "graph" in interview prep context means Graph algorithms, not charts
6. **Prioritize relevance**: Items at the top of the list are pre-sorted by relevance to the intent

## Output Format

Return ONLY a valid JSON object with this exact structure (no other text, no markdown, no code blocks):

{
  "selectedNumbers": [1, 3, 5, 7, 9],
  "reasoning": "Brief explanation of why these items match the user's intent"
}

The "selectedNumbers" array must contain exactly ${questionCount} numbers, each corresponding to a question number from the list above (1-based indexing).`;

      const response = await aiService.generateContent(selectionPrompt, { 
        maxOutputTokens: 200,
        responseMimeType: 'application/json'
      });
      const responseText = (response?.text || response || '').trim();
      
      console.log('[orchestrateMoodSession] AI response', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 150)
      });
      
      // Parse the JSON response
      let numbers = [];
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.selectedNumbers && Array.isArray(parsed.selectedNumbers)) {
          numbers = parsed.selectedNumbers
            .map(n => parseInt(n, 10) - 1) // Convert to 0-based index
            .filter(n => n >= 0 && n < itemsForPrompt.length);
          console.log('[orchestrateMoodSession] Parsed JSON response', {
            reasoning: parsed.reasoning,
            selectedNumbers: parsed.selectedNumbers,
            mappedIndices: numbers
          });
        } else {
          // Fallback: try to extract numbers from text
          numbers = responseText.match(/\d+/g)?.map(n => parseInt(n, 10) - 1).filter(n => n >= 0 && n < itemsForPrompt.length) || [];
        }
      } catch (parseErr) {
        // Fallback: extract numbers from text if JSON parsing fails
        console.warn('[orchestrateMoodSession] JSON parse failed, using text extraction', parseErr);
        numbers = responseText.match(/\d+/g)?.map(n => parseInt(n, 10) - 1).filter(n => n >= 0 && n < itemsForPrompt.length) || [];
      }
      
      // Map indices from itemsForPrompt back to normalizedUncompletedItems
      const mappedIndices = numbers.map(idx => {
        const item = itemsForPrompt[idx];
        if (!item) return null;
        return normalizedUncompletedItems.findIndex(nItem => nItem.id === item.id);
      }).filter(idx => idx >= 0 && idx < normalizedUncompletedItems.length);
      
      console.log('[orchestrateMoodSession] Parsed AI indices', {
        originalNumbers: numbers,
        mappedIndices,
        mappedLength: mappedIndices.length,
        questionCount,
        validIndices: mappedIndices.slice(0, questionCount)
      });
      
      if (mappedIndices.length >= questionCount) {
        selectedItems = mappedIndices.slice(0, questionCount).map(idx => normalizedUncompletedItems[idx]).filter(Boolean);
        console.log('[orchestrateMoodSession] AI selected items', {
          selectedCount: selectedItems.length,
          selectedNames: selectedItems.map(item => item.name || item.title || 'Untitled')
        });
      } else {
        console.log('[orchestrateMoodSession] AI selection insufficient, will use fallback', {
          numbersLength: numbers.length,
          questionCount
        });
      }
    } catch (error) {
      console.error('[orchestrateMoodSession] AI selection failed', error);
      // AI selection failed, will use fallback
    }
  }

  // Fallback: If AI selection failed or not enough items, use keyword-based selection
  if (selectedItems.length < questionCount) {
    const remaining = normalizedUncompletedItems.filter(item => !selectedItems.some(sel => sel.id === item.id));
    
    console.log('[orchestrateMoodSession] Using fallback keyword matching', {
      selectedCount: selectedItems.length,
      remainingCount: remaining.length,
      keywords
    });
    
    // Score items based on keyword matching
    const scored = remaining.map(item => {
      let score = 0;
      const itemName = (item.name || item.title || '').toLowerCase();
      const itemPattern = (item.pattern || '').toLowerCase();
      const itemDomain = (item.domain || '').toLowerCase();
      
      // DP/Dynamic Programming matching (highest priority)
      if (keywords.dp) {
        if (itemPattern.includes('dynamic programming') || itemPattern.includes('dp') || itemName.includes('dp')) {
          score += 20; // Highest priority for DP
        }
      }
      
      // Graph matching
      if (keywords.graph) {
        if (itemPattern.includes('graph') || itemName.includes('graph')) {
          score += 15;
        }
      }
      
      // Tree matching
      if (keywords.tree) {
        if (itemPattern.includes('tree') || itemName.includes('tree')) {
          score += 15;
        }
      }
      
      // String matching
      if (keywords.string) {
        if (itemPattern.includes('string') || itemName.includes('string')) {
          score += 15;
        }
      }
      
      // Array matching
      if (keywords.array && (itemName.includes('array') || itemPattern.includes('array') || itemDomain.includes('array'))) {
        score += 10;
      }
      
      // Quality matching (well-known problems often have specific names)
      if (keywords.quality) {
        // Common quality/problematic patterns
        const qualityIndicators = ['two sum', 'three sum', 'merge', 'sort', 'reverse', 'rotate', 'search', 'find', 'maximum', 'minimum', 'longest', 'shortest'];
        if (qualityIndicators.some(indicator => itemName.includes(indicator))) {
          score += 5;
        }
        // Prefer medium difficulty for "quality" questions
        const diff = item.difficulty || 3;
        if (diff >= 2 && diff <= 4) score += 3;
      }
      
      // Pattern matching (generic)
      if (keywords.pattern && itemPattern) {
        score += 8;
      }
      
      // Domain matching
      if (keywords.dsa && (itemDomain === 'dsa' || itemDomain.includes('algorithm'))) {
        score += 5;
      }
      
      return { ...item, score, domainCount: 0 };
    });
    
    // Sort by score (descending), then by domain diversity
    const domainCounts = {};
    selectedItems.forEach(item => {
      domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
    });
    
    scored.forEach(item => {
      item.domainCount = domainCounts[item.domain] || 0;
    });
    
    const prioritized = scored.sort((a, b) => {
      // First by score
      if (b.score !== a.score) return b.score - a.score;
      // Then by domain diversity (prefer less used domains)
      if (a.domainCount !== b.domainCount) return a.domainCount - b.domainCount;
      // Then by difficulty (prefer medium)
      const aDiff = a.difficulty || 3;
      const bDiff = b.difficulty || 3;
      const aDist = Math.abs(aDiff - 3);
      const bDist = Math.abs(bDiff - 3);
      if (aDist !== bDist) return aDist - bDist;
      // Finally by name for determinism
      return (a.name || '').localeCompare(b.name || '');
    });

    const needed = questionCount - selectedItems.length;
    const fallbackItems = prioritized.slice(0, needed).map((item, idx) => {
      // #region agent log
      if (idx === 0) {
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:276',message:'Before fallback destructuring',data:{hasId:'id' in item,id:item.id,hasScore:'score' in item,score:item.score,hasDomainCount:'domainCount' in item,domainCount:item.domainCount,keys:Object.keys(item)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      const { score, domainCount, ...rest } = item;
      // #region agent log
      if (idx === 0) {
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:280',message:'After fallback destructuring',data:{hasId:'id' in rest,id:rest.id,restKeys:Object.keys(rest),first10Keys:Object.keys(rest).slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      return rest;
    });
    selectedItems.push(...fallbackItems);
    
    console.log('[orchestrateMoodSession] Fallback items added', {
      addedCount: fallbackItems.length,
      totalSelected: selectedItems.length,
      fallbackNames: fallbackItems.map(item => item.name || item.title || 'Untitled')
    });
  }

  console.log('[orchestrateMoodSession] Final selected items', {
    totalSelected: selectedItems.length,
    selectedNames: selectedItems.map(item => item.name || item.title || 'Untitled'),
    selectedPatterns: selectedItems.map(item => item.pattern || 'none'),
    firstItemStructure: selectedItems[0] ? Object.keys(selectedItems[0]) : null,
    firstItem: selectedItems[0] ? {
      id: selectedItems[0].id,
      name: selectedItems[0].name,
      title: selectedItems[0].title,
      domain: selectedItems[0].domain,
      pattern: selectedItems[0].pattern
    } : null
  });

  // Create units from selected items
  const units = selectedItems.map((item, index) => {
    // #region agent log
    if (index === 0) {
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:304',message:'Creating unit from first item',data:{hasItem:!!item,itemKeys:item?Object.keys(item):[],first10Keys:item?Object.keys(item).slice(0,10):[],hasId:'id' in (item||{}),id:item?.id,_id:item?._id,itemId:item?.itemId,item_id:item?.item_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
    // #endregion
    
    if (!item) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:312',message:'Null item detected',data:{index},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return null;
    }
    
    // Items might use different ID fields - check common ones
    const itemId = item.id || item._id || item.itemId || item.item_id;
    if (!itemId) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sessionOrchestrator.js:318',message:'Item missing ID',data:{index,itemKeys:Object.keys(item),first20Keys:Object.keys(item).slice(0,20),itemSample:Object.fromEntries(Object.entries(item).slice(0,5))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return null;
    }
    
    // Ensure item has an id field (normalize to 'id')
    const normalizedItem = {
      ...item,
      id: itemId
    };
    
    const unit = {
      unitType: getUnitTypesForDomain(item.domain)[0] || UNIT_TYPES.CONCEPT_BITE,
      item: normalizedItem,
      rationale: customPrompt ? `Selected based on: "${customPrompt}"` : `Question ${index + 1} of ${questionCount}`,
      timeMinutes: null, // Untimed
      index
    };
    
    return unit;
  }).filter(Boolean); // Remove any null units
  
  console.log('[orchestrateMoodSession] Units created', {
    unitsCount: units.length,
    unitsWithItems: units.filter(u => u.item).length,
    unitItems: units.map(u => ({ name: u.item?.name || u.item?.title || 'none', id: u.item?.id || 'none' }))
  });
  
  if (units.length < questionCount) {
    console.warn('[orchestrateMoodSession] Warning: Created fewer units than requested', {
      requested: questionCount,
      created: units.length
    });
  }
  
  return units;
};

/**
 * Orchestrates a daily session
 * @param {Object} params
 * @param {Object} params.databases - Map of domain name to database ID(s)
 * @param {number} params.totalMinutes - Session duration
 * @param {string} params.focusMode - Focus mode
 * @param {Object} params.attemptsData - Recent attempts for readiness calculation
 * @param {Function} params.fetchItems - Fetch items by source database ID
 * @returns {Promise<Object>} Composed session
 */
export const orchestrateSession = async ({
  databases,
  totalMinutes,
  focusMode,
  attemptsData = {},
  getAttemptsData,
  fetchItems
}) => {
  // Fetch items from all databases
  // Support multiple databases per domain (arrays) with deterministic merge order
  const domainEntries = Object.entries(databases).sort(([a], [b]) => a.localeCompare(b));
  const allItems = await Promise.all(
    domainEntries.flatMap(([domain, dbIds]) => {
      // Handle both single ID and array of IDs
      const ids = Array.isArray(dbIds) ? dbIds : [dbIds];
      
      // Deterministic merge order: item count (desc) > database ID (asc)
      // First, fetch all databases to get metadata
      return Promise.all(ids.map(async (dbId) => {
        const items = await fetchItems(dbId);
        const stableItems = [...items].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        return {
          dbId,
          items: stableItems,
          itemCount: stableItems.length
        };
      })).then(dbResults => {
        // Sort by: CPRD presence (hasCPRD), item count (desc), database ID (asc)
        // Note: We don't have CPRD info here, so we'll use item count + ID
        dbResults.sort((a, b) => {
          // Higher item count first
          if (b.itemCount !== a.itemCount) {
            return b.itemCount - a.itemCount;
          }
          // Then deterministic tie-breaker (database ID)
          return a.dbId.localeCompare(b.dbId);
        });
        
        // Flatten items with source database metadata
        return dbResults.flatMap(({ dbId, items }) => 
          items.map(item => ({
            ...item,
            domain,
            domainType: classifyDomain(domain),
            sourceDatabaseId: dbId // Preserve source database metadata
          }))
        );
      });
    })
  ).then(results => results.flat());

  const attemptsContext = typeof getAttemptsData === 'function'
    ? getAttemptsData(allItems)
    : attemptsData;
  const itemAttempts = attemptsContext?.itemData || attemptsContext || {};
  const completedItemIds = new Set(attemptsContext?.completedItemIds || []);
  const reviewWindow = attemptsContext?.reviewWindow || 10;

  const tieBreak = (a, b) => (a.id || a.name || '').localeCompare(b.id || b.name || '');

  // Calculate coverage debt for each domain
  const domainDebts = {};
  Object.keys(databases).forEach(domain => {
    const domainType = classifyDomain(domain);
    const domainItems = allItems.filter(item => item.domain === domain);
    const completed = domainItems.filter(item => item.completed || completedItemIds.has(item.id));
    
    domainDebts[domain] = calculateCoverageDebt({
      weeklyFloorMinutes: getDefaultWeeklyFloor(domainType),
      minutesDoneLast7d: attemptsContext?.domainData?.[domain]?.minutesLast7d || 0,
      externalMinutesLast7d: attemptsContext?.domainData?.[domain]?.externalMinutesLast7d || 0,
      remainingUnits: domainItems.length - completed.length,
      completedUnits: completed.length
    });
  });

  const uncompletedItems = allItems.filter(item => !item.completed && !completedItemIds.has(item.id));

  // Select Review Unit (recently completed items, attempt-order based)
  const reviewCandidates = allItems
    .filter(item => {
      const attempt = itemAttempts[item.id];
      if (!attempt?.hasAttempts) return false;
      if (attempt.lastResult !== 'Solved' && attempt.lastResult !== 'Partial') return false;
      if (typeof attempt.lastAttemptIndex !== 'number') return false;
      return attempt.lastAttemptIndex <= reviewWindow;
    })
    .sort((a, b) => {
      const debtA = domainDebts[a.domain] || 0;
      const debtB = domainDebts[b.domain] || 0;
      if (debtB !== debtA) return debtB - debtA;
      const idxA = itemAttempts[a.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      const idxB = itemAttempts[b.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return tieBreak(a, b);
    });

  const reviewFallback = allItems
    .filter(item => {
      const attempt = itemAttempts[item.id];
      return attempt?.hasAttempts && (attempt.lastResult === 'Solved' || attempt.lastResult === 'Partial');
    })
    .sort((a, b) => {
      const idxA = itemAttempts[a.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      const idxB = itemAttempts[b.id]?.lastAttemptIndex ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return tieBreak(a, b);
    });

  const reviewItem = reviewCandidates[0] || reviewFallback[0] || null;
  let reviewUnit = reviewItem ? {
    unitType: getUnitTypesForDomain(reviewItem.domain)[0] || UNIT_TYPES.RECALL_CHECK,
    item: reviewItem,
    rationale: `Reviewing ${reviewItem.domain} to reinforce learning`
  } : null;

  // Select Core Unit (based on focus mode)
  const coreDomainType = focusMode === 'dsa-heavy' ? DOMAIN_TYPES.CODING :
                         focusMode === 'interview-heavy' ? DOMAIN_TYPES.INTERVIEW :
                         DOMAIN_TYPES.FUNDAMENTALS;
  
  console.log('[sessionOrchestrator] Focus mode:', focusMode, '→ Core domain type:', coreDomainType);
  console.log('[sessionOrchestrator] Available domains:', Object.keys(databases));
  console.log('[sessionOrchestrator] Uncompleted items count:', uncompletedItems.length);

  const coreCandidates = uncompletedItems
    .filter(item => {
      // Use domainType that was set when items were created, or classify on the fly
      const itemDomainType = item.domainType || classifyDomain(item.domain);
      const matches = itemDomainType === coreDomainType && !item.completed && !completedItemIds.has(item.id);
      return matches;
    })
    .map(item => {
      const diffValue = item.difficulty ?? 3;
      const difficulty = typeof diffValue === 'string' ? parseInt(diffValue, 10) : diffValue;
      const attemptMeta = itemAttempts[item.id] || {};
      return {
        ...item,
        difficulty: isNaN(difficulty) ? 3 : difficulty,
        isOverdue: attemptMeta.isOverdue || false,
        needsRefinement: attemptMeta.needsRefinement || false
      };
    });

  // Get domain mode (default LEARNING for now)
  const domainMode = getDefaultDomainMode();
  
  // Prepare readiness data - support both old and new structure
  let readinessData = {};
  let attemptsDataForPrioritization = {};
  
  if (attemptsContext?.itemData) {
    // New structure from getAttemptsData()
    attemptsDataForPrioritization = attemptsContext.itemData;
    readinessData = attemptsContext.itemReadinessMap || {};
    
    // For coding domains, use pattern-level readiness if available
    if (coreDomainType === DOMAIN_TYPES.CODING && attemptsContext.getPatternReadiness) {
      coreCandidates.forEach(item => {
        const pattern = item.pattern;
        if (pattern) {
          const patternReadiness = attemptsContext.getPatternReadiness(pattern);
          if (patternReadiness) {
            // Use pattern readiness for this item
            readinessData[item.id] = patternReadiness;
          }
        }
      });
    }
  } else {
    // Legacy structure
    readinessData = attemptsData.readiness || {};
    attemptsDataForPrioritization = {};
  }

  let prioritizedCore = prioritizeByDifficulty(
    coreCandidates,
    coreDomainType,
    readinessData,
    domainMode,
    attemptsDataForPrioritization
  );

  let coreUnit = prioritizedCore.length > 0 ? {
    unitType: getUnitTypesForDomain(prioritizedCore[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: prioritizedCore[0],
    rationale: `Core ${prioritizedCore[0].domain} work (${focusMode} mode)`
  } : null;
  
  console.log(`[sessionOrchestrator] Core candidates: ${coreCandidates.length} items of type ${coreDomainType}`);
  console.log(`[sessionOrchestrator] Selected core unit:`, coreUnit?.item?.name || 'none', 'from domain:', coreUnit?.item?.domain || 'none');
  
  if (coreCandidates.length === 0 && coreDomainType !== DOMAIN_TYPES.FUNDAMENTALS) {
    console.warn(`[sessionOrchestrator] No ${coreDomainType} items found for ${focusMode} mode. Will use fallback.`);
  }
  
  console.log(`[sessionOrchestrator] Core candidates: ${coreCandidates.length} items of type ${coreDomainType}`);
  console.log(`[sessionOrchestrator] Selected core unit:`, coreUnit?.item?.name || 'none', 'from domain:', coreUnit?.item?.domain || 'none');
  
  if (coreCandidates.length === 0 && coreDomainType !== DOMAIN_TYPES.FUNDAMENTALS) {
    console.warn(`[sessionOrchestrator] No ${coreDomainType} items found for ${focusMode} mode. Will use fallback.`);
  }

  if (!coreUnit && uncompletedItems.length > 0) {
    const fallback = [...uncompletedItems]
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (fallback) {
      coreUnit = {
        unitType: getUnitTypesForDomain(fallback.domain)[0] || UNIT_TYPES.CONCEPT_BITE,
        item: fallback,
        rationale: `No items for ${coreDomainType} focus; selecting ${fallback.domain} instead`
      };
      prioritizedCore = [fallback];
    }
  }

  // Select Breadth Unit (highest coverage debt, different domain)
  const breadthCandidates = uncompletedItems
    .filter(item => {
      if (item.domain === coreUnit?.item?.domain) return false;
      if (item.completed || completedItemIds.has(item.id)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      coverageDebt: domainDebts[item.domain] || 0
    }))
    .sort((a, b) => {
      if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
      const domainCompare = (a.domain || '').localeCompare(b.domain || '');
      if (domainCompare !== 0) return domainCompare;
      return tieBreak(a, b);
    });

  let breadthUnit = breadthCandidates.length > 0 ? {
    unitType: getUnitTypesForDomain(breadthCandidates[0].domain)[0] || UNIT_TYPES.CONCEPT_BITE,
    item: breadthCandidates[0],
    rationale: `Breadth coverage for ${breadthCandidates[0].domain}`
  } : null;

  if (!breadthUnit) {
    const fallbackBreadth = uncompletedItems
      .filter(item => item.id !== coreUnit?.item?.id)
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (fallbackBreadth) {
      breadthUnit = {
        unitType: getUnitTypesForDomain(fallbackBreadth.domain)[0] || UNIT_TYPES.CONCEPT_BITE,
        item: fallbackBreadth,
        rationale: `Breadth coverage fallback within ${fallbackBreadth.domain}`
      };
    }
  }

  if (!coreUnit || !breadthUnit) {
    throw new Error('Unable to compose a full session. Import more items and confirm domains.');
  }

  if (!reviewItem) {
    const reviewFallbackItem = uncompletedItems
      .filter(item => item.id !== coreUnit.item.id && item.id !== breadthUnit.item.id)
      .map(item => ({
        ...item,
        coverageDebt: domainDebts[item.domain] || 0
      }))
      .sort((a, b) => {
        if (b.coverageDebt !== a.coverageDebt) return b.coverageDebt - a.coverageDebt;
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;
        return tieBreak(a, b);
      })[0];

    if (!reviewFallbackItem) {
      throw new Error('Need at least three items to build a full session.');
    }

    reviewUnit = {
      unitType: getUnitTypesForDomain(reviewFallbackItem.domain)[0] || UNIT_TYPES.RECALL_CHECK,
      item: reviewFallbackItem,
      rationale: `No review history yet; starting recall in ${reviewFallbackItem.domain}`
    };
  }

  return {
    reviewUnit,
    coreUnit,
    breadthUnit
  };
};
