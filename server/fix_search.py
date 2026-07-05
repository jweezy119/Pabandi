import sys

with open('src/routes/business.routes.ts', 'r') as f:
    content = f.read()

old_search_logic = """    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } }
      ];
    }"""

new_search_logic = """    if (search) {
      const searchTerms = String(search)
        .trim()
        .split(/\\s+/)
        .filter(term => term.length > 0);
        
      if (searchTerms.length > 0) {
        where.AND = searchTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { city: { contains: term, mode: 'insensitive' } },
            { category: { contains: term, mode: 'insensitive' } },
            { address: { contains: term, mode: 'insensitive' } }
          ]
        }));
      }
    }"""

if old_search_logic in content:
    content = content.replace(old_search_logic, new_search_logic)
    with open('src/routes/business.routes.ts', 'w') as f:
        f.write(content)
    print("Successfully replaced search logic in business.routes.ts")
else:
    print("Error: Could not find old search logic to replace.")
