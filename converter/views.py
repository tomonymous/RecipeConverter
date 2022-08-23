import unicodedata
import re
from decimal import Decimal
from text2digits import text2digits
from django.shortcuts import render
from .models import Ingredient
import nltk
nltk.download('punkt')
nltk.download('averaged_perceptron_tagger')
from textblob import TextBlob
from bs4 import BeautifulSoup
from bs4.element import Comment
import urllib.request
import json

measures = ['litre', 'l', 'millilitre', 'ml', 'gram', 'g', 'gm', 'kilogram', 'kg', 'teaspoon', 'tsp', 'dessertspoon',
            'dstspn', 'dspn', 'dsp', 'dssp', 'tablespoon', 'tbpn', 'tbsp', 'ounce', 'oz', 'pound', 'lb', 'cup', 'c',
            'pint',
            'pt', 'quart', 'qt', 'gallon', 'gal', 'cm', 'can', 'tin', 'handful', 'rasher',
            'litres', 'ls', 'milliliters', 'mls', 'grams', 'gs', 'gms', 'kilograms', 'kgs', 'teaspoons', 'tsps',
            'dessertspoons', 'dstspns', 'dspns', 'dsps', 'dssps', 'tablespoons', 'tbpns', 'tbsps', 'ounces', 'ozs',
            'pounds',
            'lbs', 'cups', 'cs', 'pints', 'pts', 'quarts', 'qts', 'gallons', 'gals', 'cms',
            'cans', 'tins', 'handfuls', 'rashers', 'milliliter', 'milliliters', 'floz', 'inch', 'inches', 'dram',
            'drams',
            'gill', 'gi'
            ]  # , 'cloves', 'bunch', 'sprigs'

instruction_terms = ['instructions', 'method', 'directions', 'preparation']

def index(request):
    ingredients = Ingredient.objects.all()
    return render(request, 'index.html',
                  {'ingredients': ingredients})

def search(request):
    #url = 'https://www.allrecipes.com/recipe/273786/spicy-korean-fried-chicken-with-gochujang-sauce/'
    #url = 'https://www.bonappetit.com/recipe/perfect-pizza'
    #url = 'https://www.seriouseats.com/crispy-braised-chicken-white-beans-chile-verde-hatch-food-lab-recipe'
    #url = 'https://www.jamieoliver.com/recipes/chicken-recipes/thai-green-chicken-curry/'
    #url = 'https://www.joshuaweissman.com/post/easy-authentic-thai-green-curry'
    #url = 'https://www.bbc.co.uk/food/recipes/cumberland_sausage_59571'
    #url = 'https://food52.com/recipes/61557-classic-nigerian-jollof-rice'
    title = 'Recipe'
    link = request.GET.get('link')
    query = request.GET.get('query')
    directions = request.GET.get('directions')
    if link is not None:
        query = ''
        directions = ''
        ingredient_list = []
        if link[0:8].lower() != "https://":
            link = 'https://' + link
        try:
            req = urllib.request.Request(link, headers={'User-Agent': 'Mozilla/5.0'})
            html = urllib.request.urlopen(req).read()
            ingredient_list = findItems('ingredients', html)
            soup = BeautifulSoup(html, 'html.parser')
            title = soup.find('title').string
        except Exception as e:
            print("The error raised is: ", e)

        directions_found = False
        try:
            for text in ingredient_list:
                line = re.sub('\s+', ' ', text).strip()
                line = re.sub(' / ', '/', line)
                if not directions_found:
                    if re.sub('[^a-zA-Z\s]', '', line).lower() in instruction_terms:
                        directions_found = True
                        directions += line + '\n'
                    elif 'ingredient' in text[:14].lower():
                        if checkListForIngredients(query):
                            query += line + '\n'
                        else:
                            query = ''
                    else:
                        query += line + '\n'
                else:
                    directions += line + '\n'

            if directions == '':
                directions_list = findItems('directions', html)
                if directions_list != None:
                    for text in directions_list:
                        line = re.sub('\s+', ' ', text).strip()
                        directions += line + '\n'
        except:
            query = "Sorry no recipe found."


    t2d = text2digits.Text2Digits()
    if directions != None:
        directions_lines = directions.splitlines()
        directions = ''
        for line in directions_lines:                       #formats directions with new lines.
            if len(line.strip()) > 0:
                directions += """
 """
                directions += line.strip()
                directions += """
 """
        directions = " " + directions.strip()
    if len(query) < 1:
        query = 'Sorry, no recipe found.'
    ingredients = []
    match = re.search('\d+\/+\d', query)                #converts written out fractions to decimals
    while match:
        decimal = eval(match.group())
        query = query[:match.start()] + str(Decimal(decimal).quantize(Decimal("2.00"))) + query[match.end():]
        match = re.search('\d+\/+\d', query)

    match = re.search('\d 0.', query)                   #deals with any whole numbers in fractions
    while match:
        replacement = match.group()[:1] + match.group()[-1:]
        query = query[:match.start()] + replacement + query[match.end():]
        match = re.search('\d 0.', query)
    query = re.sub(r'(?<=\d)(?=[^\d\s.])|(?<=[^\d\s.])(?=\d)', ' ', query)       #add space between numbers and units
    query = re.sub('’',r"'", query)                     #replace ’ with ' for more predictable TextBlob
    query = re.sub('-|–', r" - ", query)                  #ensure space around hypens
    query = re.sub('/|\\\\', r" or ", query)
    query = t2d.convert(query)                          #convert written numbers to digits

    query = re.sub(r'\.(?!\d)', '', query)              #remove non numeric periods
    match = re.search('([0-9]+\.?[0-9]*|\.[0-9]+)\s+(to|-)\s+([0-9]+\.?[0-9]*|\.[0-9]+)', query)  # eg. converts 'two to three' to 2.5

    while match:
        numbers = re.findall('[0-9]+\.?[0-9]*|\.[0-9]+', match.group())
        number = (Decimal(numbers[0]) + Decimal(numbers[1])) / 2
        query = query[:match.start()] + str(number) + query[match.end():]
        match = re.search('([0-9]+\.?[0-9]*|\.[0-9]+)\s+(to|-)\s+([0-9]+\.?[0-9]*|\.[0-9]+)', query)

    match = re.search('\d(\s+|)(x|X)(\s+|)\d', query)  # eg. converts '2 x 400g' to 800g
    while match:
        numbers = re.findall('\d', match.group())
        number = int(numbers[0]) * int(numbers[1])
        query = query[:match.start()] + str(number) + query[match.end():]
        match = re.search('\d(\s+|)(x|X)(\s+|)\d', query)

    query = re.sub('fluid ounce|fl oz|oz fl', r"floz", query)
    ingredient_descriptions = query.splitlines()
    accidental_split_correction = ''
    for text in ingredient_descriptions:
        ingredient = Ingredient()
        text = text.strip()
        if accidental_split_correction != '':
            text = accidental_split_correction + ' ' + text
            accidental_split_correction = ''
        if len(text) < 6:                               #corrects for formatting where quantities on different line
            accidental_split_correction = text
            continue
        description = ''
        adjectives = ''
        last_word = ''
        last_designation = 'name'
        temp = ''
        if '(' in text:
            try:
                description = text[text.index("("):text.index(")")+1] + " "
                text = text[:text.index("(")] + text[text.index(")"):]
            except:
                pass

        #if ',' in text:
        #    try:
        #        description = text[text.index(",")+1:] + " "
        #         text = text[:text.index(",")]
        #    except:
        #        pass

        if ' of ' in text:
            if ' of the ' not in text:
                try:
                    text = text[text.index(" of ")+4:] + " " + text[:text.index(" of ")]
                except:
                    pass

        blob = TextBlob(text.strip())
        blob.tags
        name_found = False
        parsing_name = False
        unit_found = False
        quantity_found = False
        for tagged_words in blob.tags:
            is_numeric = False
            word = tagged_words[0]
            if word == '0':                                         #correct Texblob decimal separation (0.XXX)
                temp = word
                continue
            if temp == '0':
                word = '0.' + word
                temp = ''

            if word == "'s":                                         #correct Texblob separation (bird's eye chillis)
                exec('ingredient.' + last_designation + ' += word')
                continue
            try:
                number = float(word)
                is_numeric = True
            except ValueError:
                pass
            tag = tagged_words[1]
            word = word.lower()
            if word == 'cans' or word == 'tins':
                word = word[0:-1] + 'ned'
            elif word == 'can' or word == 'tin':
                word = word + 'ned'
            if word == 'seasoning':
                tag = 'NN'
            if last_word == 'ground' and tag == 'JJ':
                tag = 'NN'
            if word == 'quality':
                tag = 'VBD'
            if word == 'medium':
                tag = 'JJ'
            if word == 'sized':
                tag = 'JJ'
            if word == 'virgin':
                tag = 'JJ'
            if len(word) == 1 and unicodedata.name(word).split()[0] == 'VULGAR':
                word = unicodedata.numeric(word)
                ingredient.quantity = round(Decimal(word), 2)
                last_designation = 'quantity'
                quantity_found = True
            elif is_numeric:
                if not quantity_found:
                    ingredient.quantity = Decimal(word).quantize(Decimal("2.00"))
                    last_designation = 'quantity'
                    quantity_found = True
                else:
                    ingredient.description = (ingredient.description + ' ' + word).strip()
                    last_designation = 'description'
            elif word in measures:
                if not unit_found:
                    ingredient.units = word
                    if word == 'floz':
                        ingredient.units = 'fl oz'
                    last_designation = 'unit'
                    unit_found = True
                else:
                    ingredient.description += word + ' '
                    last_designation = 'description'
            elif not name_found:
                if word == 'or':
                    ingredient.description += word + ' '
                    last_designation = 'description'
                elif tag == 'NN' or tag == 'NNS' or tag == 'NNPS' or tag == 'NNP':
                    ingredient.name = (adjectives + ' ' + word).strip()
                    adjectives = ''
                    last_designation = 'name'
                    name_found = True
                    parsing_name = True
                elif tag == 'VBD' and not unit_found:
                    ingredient.description += word + ' '
                    last_designation = 'description'
                else:
                    if tag != "IN" and tag != "DT":
                        if word == 'cans' or word == 'tins':
                            word = word[0:-1] + 'ned'
                        elif word == 'can' or word == 'tin':
                            word = word + 'ned'
                        adjectives += word + " "
            else:
                if parsing_name:
                    if tag == 'NN' or tag == 'NNS' or tag == 'NNPS' or tag == 'NNP':
                        if word == 'cans' or word == 'tins':
                            word = word[0:-1] + 'ned'
                        elif word == 'can' or word == 'tin':
                            word = word + 'ned'
                        ingredient.name = (adjectives + ' ' + ingredient.name + ' ' + word).strip()
                        last_designation = 'name'
                    else:
                        parsing_name = False
                        ingredient.description += word + " "
                        last_designation = 'description'
                else:
                    ingredient.description += word + " "
                    last_designation = 'description'
            last_word = word
        ingredient.description = (ingredient.description + ' ' + description).strip()
        if ingredient.name != '':
            if ingredient.units == '' and ingredient.quantity is None and ingredient.description == '':                                      #if only name attribute found and not
                if 'salt' not in ingredient.name and 'pepper' not in ingredient.name and 'oil' not in ingredient.name:                       #salt or pepper then mark as subtitle.
                    ingredient.name = '#' + ingredient.name.strip()
            ingredient.name = ingredient.name.strip().title()
            ingredients.append(ingredient)
        elif ingredient.description != '':
            ingredient.name = ingredient.description.strip().title()
            ingredient.description = ''
            if ingredient.units == '' and ingredient.quantity is None:
                if 'salt' not in ingredient.name and 'pepper' not in ingredient.name and 'oil' not in ingredient.name:
                    ingredient.name = '#' + ingredient.name.strip()
            ingredients.append(ingredient)
        elif adjectives != '':
            ingredient.name = adjectives.strip().title()
            adjectives = ''
            if ingredient.units == '' and ingredient.quantity is None and ingredient.description == '':
                if 'salt' not in ingredient.name and 'pepper' not in ingredient.name and 'oil' not in ingredient.name:
                    ingredient.name = '#' + ingredient.name.strip()
            ingredients.append(ingredient)
        else:
            ingredient.name = text.strip()
            ingredients.append(ingredient)
    if len(ingredients) == 0:
        is_empty = True
    else:
        is_empty = False
    ingredient_names = []
    ingredient_units = []
    ingredient_values = []
    ingredient_descriptions = []
    for ingredient in ingredients:
        ingredient_names.append(" ".join(ingredient.name.split()))
        ingredient_units.append(" ".join(ingredient.units.split()))
        ingredient_values.append(" ".join(str(ingredient.quantity).split()))
        ingredient_descriptions.append(" ".join(ingredient.description.strip().capitalize().split()))
    json_ingredients = json.dumps(ingredient_names)
    json_units = json.dumps(ingredient_units)
    json_values = json.dumps(ingredient_values)
    json_descriptions = json.dumps(ingredient_descriptions)
    return render(request, 'search.html', {'ingredients': ingredients, 'searchString': query, 'directions': directions,
                                           'empty': is_empty, 'title': title,
                                           'ingredient_names': json_ingredients, 'ingredient_units': json_units,
                                           'ingredient_values': json_values,
                                           'ingredient_descriptions': json_descriptions})

def tag_visible(element):
    if len(element.strip()) < 1:
        return False
    if element.parent.name in ['style', 'script', 'head', 'title', 'meta', '[document]']:
        return False
    if isinstance(element, Comment):
        return False
    return True

def text_from_html(body):
    soup = BeautifulSoup(body, 'html.parser')
    texts = soup.findAll(text=True)
    visible_texts = filter(tag_visible, texts)
    return visible_texts

def findKeyParent(type, text, scope, ingred_count):
    keyParent = None
    found_ingredients = False
    match = False
    count = 0
    for t in text:
        if type == 'ingredients':
            if len(t.strip()) < 16 and 'ingredient' in t.strip().lower():
                match = True
        else:
            for term in instruction_terms:
                if len(t.strip()) < len(term) + 5 and term in t.strip().lower():
                    match = True
        if match and not found_ingredients:
            count += 1
            if ingred_count == count:
                found_ingredients = True
                keySet = False
                for parent in t.parents:
                    if len(parent.contents) > scope and not keySet:
                        keyParent = parent
                        keySet = True
                if keySet:
                    return keyParent
            else:
                match = False
    return None

def findIngredientList(type, count, html):
    found = False
    not_found = False
    item_string = ''
    item_list = []
    scope = 1
    while found == False and not_found == False:
        text = text_from_html(html)
        key = findKeyParent(type, text, scope, count)
        if key == None:
            not_found = True
        previous_parent = None
        last_list_item = None
        included_nodes = []
        for t in text:
            if len(t.strip()) > 0:
                for parent in t.parents:
                    if key == parent:
                        current_list_item = None
                        for list_parent in t.parents:
                            if list_parent.name == 'li':
                                current_list_item = list_parent
                                break
                        line = re.sub('\s+', ' ', t).strip()
                        if len(item_list) > 0 and current_list_item != None and current_list_item == last_list_item \
                                and (t.parent in included_nodes or t.parent.previous_sibling != None) and (previous_parent == t.parent
                                                                           or t.parent.name == 'span'
                                                                           or t.parent.name == 'sub'
                                                                           or t.parent.name == 'a'
                                                                           or previous_parent in t.parent.children):
                            item_list[len(item_list)-1] = item_list[len(item_list)-1] + ' ' + line
                            last_list_item = current_list_item
                            included_nodes.append(t.parent)
                        else:
                            item_list.append(line)
                            last_list_item = current_list_item
                            included_nodes.append(t.parent)
                        item_string += '\n' + line
                        previous_parent = t.parent
                        break
        if type == 'ingredients':
            item_string = re.sub(r'(?<=\d)(?=[^\d\s.])|(?<=[^\d\s.])(?=\d)', ' ', item_string)  # add space between numbers and units
            item_string = re.sub('-', r" - ", item_string)
            item_string = re.sub('/', r" / ", item_string)
            item_string_list = item_string.split()
            if checkListForIngredients(item_string_list):
                found = True
                break
        elif len(item_list) > 0:
            lengths = []
            for item in item_list:
                lengths.append(len(item))
            lengths.sort()
            total = 0
            avg_length = 0
            if len(lengths) < 4:
                for length in lengths:
                    total += length
                avg_length = total / len(lengths)
            else:
                for length in lengths[len(lengths) - 3:]:
                    total += length
                avg_length = total/3
            if avg_length > 50:
                found = True
                break
        if key == None:
            break
        else:
            scope = len(key.contents)
    return (scope, item_list)

def findItems(type, html):

    list_options = []
    list = None
    count = 0
    text = text_from_html(html)
    for t in text:                                                                      #Counts occurences of short elements that contain 'ingredient'
        if type == 'ingredients':
            if len(t.strip()) < 16 and 'ingredient' in t.strip().lower():
                count += 1
        else:
            for term in instruction_terms:
                if len(t.strip()) < 16 and term in t.strip().lower():
                    count += 1
    for instance in range(1, count+1):
        list_options.append(findIngredientList(type, instance, html))

    smallest_scope = None
    count = 0
    for option in list_options:
        count += 1
        if smallest_scope == None or smallest_scope > option[0]:
            smallest_scope = option[0]
            list = option[1]
    return list

def checkListForIngredients(item_string_list):
    number_count = 0
    measure_count = 0
    for word in item_string_list:
        is_numeric = False
        try:
            number = float(word)
            is_numeric = True
        except ValueError:
            pass
        if word in measures:
            measure_count += 1
        elif is_numeric:
            number_count += 1
        if number_count > 3 and measure_count > 1:
            return True
    return False